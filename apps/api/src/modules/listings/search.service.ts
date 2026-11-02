import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { ListingCard, ListingQuery, Paginated } from '@sellnest/shared';
import { paginated } from '../../common/dtos';
import { PrismaService } from '../../common/prisma.service';
import { RedisService } from '../../common/redis.service';
import { CARD_INCLUDE, ListingMapper } from './listing.mapper';

interface RankedRow {
  id: string;
  distance_m: number | null;
}

const likeEscape = (q: string) => q.replace(/[\\%_]/g, '\\$&');

@Injectable()
export class SearchService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly mapper: ListingMapper,
  ) {}

  /**
   * Finds matching ids with SQL (filters, search and geography), then hydrates cards with Prisma
   * in one batch, avoiding N+1 queries. Radius filtering uses ST_DWithin and "nearest" uses KNN
   * (<->), both served by the GiST index rather than a table scan.
   */
  async search(query: ListingQuery, viewerId?: string): Promise<Paginated<ListingCard>> {
    const { page, limit } = query;
    const where: Prisma.Sql[] = [
      Prisma.sql`l."deletedAt" IS NULL`,
      Prisma.sql`u."status" = 'ACTIVE'`,
    ];

    if (query.availability === 'sold') where.push(Prisma.sql`l."status" = 'SOLD'`);
    else if (query.availability === 'all') where.push(Prisma.sql`l."status" IN ('ACTIVE', 'SOLD')`);
    else where.push(Prisma.sql`l."status" = 'ACTIVE'`);

    if (query.sellerId) {
      where.push(Prisma.sql`l."sellerId" = ${query.sellerId}::uuid`);
      // Sellers can hide their sold history.
      if (query.availability !== 'available') {
        where.push(Prisma.sql`(u."showSoldListings" OR l."status" <> 'SOLD')`);
      }
    }
    if (query.ids) {
      const ids = query.ids.split(',').slice(0, 48);
      where.push(Prisma.sql`l."id" = ANY(${ids}::uuid[])`);
    }
    if (query.category) {
      const ids = await this.categoryIds(query.category);
      if (ids.length === 0) return paginated([], 0, page, limit);
      where.push(Prisma.sql`l."categoryId" = ANY(${ids}::uuid[])`);
    }
    if (query.minPrice != null) where.push(Prisma.sql`l."priceBdt" >= ${query.minPrice}`);
    if (query.maxPrice != null) where.push(Prisma.sql`l."priceBdt" <= ${query.maxPrice}`);
    if (query.condition) {
      const conditions = Array.isArray(query.condition) ? query.condition : [query.condition];
      where.push(Prisma.sql`l."condition"::text = ANY(${conditions}::text[])`);
    }

    let point: Prisma.Sql | null = null;
    if (query.location) {
      const location = await this.prisma.location.findFirst({
        where: { slug: query.location, isActive: true },
        select: { id: true, latitude: true, longitude: true },
      });
      if (!location) throw new NotFoundException('That location was not found');
      point = Prisma.sql`ST_SetSRID(ST_MakePoint(${location.longitude}::float8, ${location.latitude}::float8), 4326)::geography`;
      if (query.radiusKm) {
        where.push(Prisma.sql`ST_DWithin(l."geo", ${point}, ${query.radiusKm * 1000}::float8)`);
      } else {
        const ids = await this.locationSubtreeIds(location.id);
        where.push(Prisma.sql`l."locationId" = ANY(${ids}::uuid[])`);
      }
    }

    let rank: Prisma.Sql | null = null;
    if (query.q) {
      const q = query.q;
      const like = `%${likeEscape(q)}%`;
      where.push(Prisma.sql`(
        l."searchVector" @@ websearch_to_tsquery('english', ${q})
        OR word_similarity(${q}, l."title") >= 0.45
        OR l."title" ILIKE ${like}
        OR l."categoryId" IN (SELECT "id" FROM "Category" WHERE "isActive" AND "name" ILIKE ${like})
        OR l."locationId" IN (SELECT "id" FROM "Location" WHERE "isActive" AND "name" ILIKE ${like})
      )`);
      rank = Prisma.sql`(ts_rank(l."searchVector", websearch_to_tsquery('english', ${q})) * 2 + word_similarity(${q}, l."title"))`;
    }

    const whereSql = Prisma.join(where, ' AND ');
    const sort = this.resolveSort(query, Boolean(point), Boolean(rank));
    const orderBy = {
      relevance: rank ? Prisma.sql`${rank} DESC, l."publishedAt" DESC` : Prisma.sql`l."publishedAt" DESC`,
      nearest: point ? Prisma.sql`l."geo" <-> ${point}, l."publishedAt" DESC` : Prisma.sql`l."publishedAt" DESC`,
      newest: Prisma.sql`l."publishedAt" DESC`,
      price_asc: Prisma.sql`l."priceBdt" ASC, l."publishedAt" DESC`,
      price_desc: Prisma.sql`l."priceBdt" DESC, l."publishedAt" DESC`,
    }[sort];
    const distance = point ? Prisma.sql`ST_Distance(l."geo", ${point})` : Prisma.sql`NULL::float8`;

    const [rows, countRows] = await Promise.all([
      this.prisma.$queryRaw<RankedRow[]>(Prisma.sql`
        SELECT l."id", ${distance} AS distance_m
        FROM "Listing" l JOIN "User" u ON u."id" = l."sellerId"
        WHERE ${whereSql}
        ORDER BY ${orderBy}, l."id"
        LIMIT ${limit} OFFSET ${(page - 1) * limit}`),
      this.prisma.$queryRaw<{ count: bigint }[]>(Prisma.sql`
        SELECT COUNT(*) AS count
        FROM "Listing" l JOIN "User" u ON u."id" = l."sellerId"
        WHERE ${whereSql}`),
    ]);

    const items = await this.hydrate(rows, viewerId);
    return paginated(items, Number(countRows[0]?.count ?? 0), page, limit);
  }

  private resolveSort(query: ListingQuery, hasPoint: boolean, hasRank: boolean) {
    if (query.sort === 'relevance' && !hasRank) return 'newest';
    if (query.sort === 'nearest' && !hasPoint) return 'newest';
    if (query.sort) return query.sort;
    if (hasRank) return 'relevance';
    return hasPoint && query.radiusKm ? 'nearest' : 'newest';
  }

  private async hydrate(rows: RankedRow[], viewerId?: string): Promise<ListingCard[]> {
    if (rows.length === 0) return [];
    const ids = rows.map((r) => r.id);
    const [listings, favorites] = await Promise.all([
      this.prisma.listing.findMany({ where: { id: { in: ids } }, include: CARD_INCLUDE }),
      viewerId
        ? this.prisma.favorite.findMany({ where: { userId: viewerId, listingId: { in: ids } }, select: { listingId: true } })
        : [],
    ]);
    const byId = new Map(listings.map((l) => [l.id, l]));
    const favoriteIds = new Set(favorites.map((f) => f.listingId));
    return rows.flatMap((r) => {
      const listing = byId.get(r.id);
      if (!listing) return [];
      const distanceKm = r.distance_m == null ? null : Math.round(r.distance_m / 100) / 10;
      return [this.mapper.card(listing, { distanceKm, isFavorite: favoriteIds.has(r.id) })];
    });
  }

  async suggestions(q: string) {
    const like = `%${likeEscape(q)}%`;
    const [titles, categories] = await Promise.all([
      this.prisma.$queryRaw<{ title: string }[]>(Prisma.sql`
        SELECT "title" FROM (
          SELECT DISTINCT ON (lower("title")) "title", word_similarity(${q}, "title") AS score
          FROM "Listing"
          WHERE "status" = 'ACTIVE' AND "deletedAt" IS NULL
            AND (word_similarity(${q}, "title") >= 0.45 OR "title" ILIKE ${like})
          ORDER BY lower("title"), score DESC
        ) t ORDER BY score DESC LIMIT 6`),
      this.prisma.category.findMany({
        where: { isActive: true, name: { contains: q, mode: 'insensitive' } },
        select: { slug: true, name: true },
        take: 3,
      }),
    ]);
    return { titles: titles.map((t) => t.title), categories };
  }

  /** A parent category includes its subcategories. */
  private categoryIds(slug: string) {
    return this.redis.cached(`category-ids:${slug}`, 300, async () => {
      const category = await this.prisma.category.findFirst({
        where: { slug, isActive: true },
        select: { id: true, children: { where: { isActive: true }, select: { id: true } } },
      });
      return category ? [category.id, ...category.children.map((c) => c.id)] : [];
    });
  }

  private locationSubtreeIds(id: string) {
    return this.redis.cached(`location-subtree:${id}`, 300, async () => {
      const rows = await this.prisma.$queryRaw<{ id: string }[]>(Prisma.sql`
        WITH RECURSIVE tree AS (
          SELECT "id" FROM "Location" WHERE "id" = ${id}::uuid
          UNION ALL
          SELECT c."id" FROM "Location" c JOIN tree ON c."parentId" = tree."id"
        ) SELECT "id" FROM tree`);
      return rows.map((r) => r.id);
    });
  }
}
