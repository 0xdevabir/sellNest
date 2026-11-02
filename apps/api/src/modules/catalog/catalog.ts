import { Controller, Get, Injectable, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Prisma } from '@prisma/client';
import { CategoryNode, LocationNode, NearbyLocation, PublicConfig } from '@sellnest/shared';
import { Public, RateLimit } from '../../common/auth.decorators';
import { NearbyLocationsQueryDto } from '../../common/dtos';
import { PrismaService } from '../../common/prisma.service';
import { RedisService } from '../../common/redis.service';
import { SettingsService } from '../../common/settings.service';
import { StorageService } from '../../common/storage.service';

const CACHE = { categories: 'catalog:categories', locations: 'catalog:locations', popular: 'catalog:popular' };

@Injectable()
export class CatalogService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly settings: SettingsService,
    private readonly storage: StorageService,
  ) {}

  categories(): Promise<CategoryNode[]> {
    return this.redis.cached(CACHE.categories, 600, async () => {
      const rows = await this.prisma.category.findMany({
        where: { isActive: true },
        orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      });
      const toNode = (c: (typeof rows)[number]): CategoryNode => ({
        id: c.id,
        slug: c.slug,
        name: c.name,
        icon: c.icon,
        parentId: c.parentId,
        children: rows.filter((r) => r.parentId === c.id).map(toNode),
      });
      return rows.filter((r) => !r.parentId).map(toNode);
    });
  }

  /** Top-level categories by real active-listing counts. */
  popularCategories(): Promise<{ slug: string; name: string; icon: string | null; count: number }[]> {
    return this.redis.cached(CACHE.popular, 300, async () => {
      const rows = await this.prisma.$queryRaw<{ slug: string; name: string; icon: string | null; count: bigint }[]>(Prisma.sql`
        SELECT top."slug", top."name", top."icon", COUNT(l."id") AS count
        FROM "Category" top
        LEFT JOIN "Category" child ON child."parentId" = top."id"
        JOIN "Listing" l ON l."categoryId" IN (top."id", child."id")
          AND l."status" = 'ACTIVE' AND l."deletedAt" IS NULL
        WHERE top."parentId" IS NULL AND top."isActive"
        GROUP BY top."id"
        ORDER BY count DESC LIMIT 6`);
      return rows.map((r) => ({ ...r, count: Number(r.count) }));
    });
  }

  locations(): Promise<LocationNode[]> {
    return this.redis.cached(CACHE.locations, 600, async () => {
      const rows = await this.prisma.location.findMany({
        where: { isActive: true },
        include: { parent: { select: { name: true } } },
        orderBy: [{ isFeatured: 'desc' }, { name: 'asc' }],
      });
      return rows.map((l) => ({
        id: l.id,
        slug: l.slug,
        name: l.name,
        type: l.type,
        parentId: l.parentId,
        parentName: l.parent?.name ?? null,
        isFeatured: l.isFeatured,
      }));
    });
  }

  /** KNN over the GiST index. Coordinates are used for this query only and are never stored. */
  async nearby(lat: number, lng: number): Promise<NearbyLocation[]> {
    const point = Prisma.sql`ST_SetSRID(ST_MakePoint(${lng}::float8, ${lat}::float8), 4326)::geography`;
    const rows = await this.prisma.$queryRaw<(Omit<NearbyLocation, 'distanceKm'> & { distance_m: number })[]>(Prisma.sql`
      SELECT "id", "slug", "name", "type", ST_Distance("geo", ${point}) AS distance_m
      FROM "Location"
      WHERE "isActive" AND "type" NOT IN ('COUNTRY', 'DIVISION')
      ORDER BY "geo" <-> ${point}
      LIMIT 5`);
    return rows.map(({ distance_m, ...r }) => ({ ...r, distanceKm: Math.round(distance_m / 100) / 10 }));
  }

  async publicConfig(): Promise<PublicConfig> {
    const s = await this.settings.get();
    const featured = await this.redis.cached('catalog:default-location', 600, () =>
      this.prisma.location.findFirst({
        where: { isActive: true, isFeatured: true },
        orderBy: { createdAt: 'asc' },
        select: { slug: true },
      }),
    );
    return {
      radiiKm: s.radiiKm,
      defaultRadiusKm: s.defaultRadiusKm,
      defaultLocationSlug: featured?.slug ?? null,
      maxListingImages: s.maxListingImages,
      uploadsEnabled: this.storage.enabled,
    };
  }

  invalidateCatalog() {
    return this.redis.invalidate(...Object.values(CACHE), 'catalog:default-location');
  }
}

@ApiTags('catalog')
@Controller()
export class CatalogController {
  constructor(private readonly catalog: CatalogService) {}

  @Public()
  @Get('categories')
  categories() {
    return this.catalog.categories();
  }

  @Public()
  @Get('categories/popular')
  popular() {
    return this.catalog.popularCategories();
  }

  @Public()
  @Get('locations')
  locations() {
    return this.catalog.locations();
  }

  @Public()
  @RateLimit({ name: 'nearby', limit: 30, windowSeconds: 60 })
  @Get('locations/nearby')
  nearby(@Query() q: NearbyLocationsQueryDto) {
    return this.catalog.nearby(q.lat, q.lng);
  }

  @Public()
  @Get('communities')
  async communities() {
    const all = await this.catalog.locations();
    return all.filter((l) => l.type === 'CAMPUS' || l.type === 'COMMUNITY');
  }

  @Public()
  @Get('config')
  config() {
    return this.catalog.publicConfig();
  }
}
