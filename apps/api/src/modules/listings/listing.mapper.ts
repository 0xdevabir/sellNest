import { Injectable } from '@nestjs/common';
import { ListingImage, Prisma, User } from '@prisma/client';
import { IMAGE_VARIANT_WIDTHS, ImageVariants, ListingCard, listingPath, PublicUserSummary } from '@sellnest/shared';
import { StorageService } from '../../common/storage.service';

export const CARD_INCLUDE = {
  images: { orderBy: { position: 'asc' }, take: 1 },
  location: { select: { name: true } },
} satisfies Prisma.ListingInclude;

export type CardRow = Prisma.ListingGetPayload<{ include: typeof CARD_INCLUDE }>;

@Injectable()
export class ListingMapper {
  constructor(private readonly storage: StorageService) {}

  image(row: ListingImage): ImageVariants {
    return {
      id: row.id,
      width: row.width,
      height: row.height,
      urls: Object.fromEntries(
        IMAGE_VARIANT_WIDTHS.map((w) => [String(w), this.storage.publicUrl(`${row.keyBase}/${w}.webp`)]),
      ),
    };
  }

  /** Allow-list of public user fields: email, role and password hash can never leak through here. */
  user(user: Pick<User, 'id' | 'username' | 'displayName' | 'avatarKey' | 'emailVerifiedAt' | 'isDemo'>): PublicUserSummary {
    return {
      id: user.id,
      username: user.username,
      displayName: user.displayName,
      avatarUrl: user.avatarKey ? this.storage.publicUrl(`${user.avatarKey}/320.webp`) : null,
      // Demo accounts are verified so they can be used, but must never look like verified people.
      emailVerified: Boolean(user.emailVerifiedAt) && !user.isDemo,
    };
  }

  card(row: CardRow, opts: { distanceKm?: number | null; isFavorite?: boolean } = {}): ListingCard {
    return {
      id: row.id,
      path: listingPath(row),
      title: row.title ?? 'Untitled',
      priceBdt: row.priceBdt ?? 0,
      negotiable: row.negotiable,
      condition: row.condition ?? 'GOOD',
      status: row.status,
      cover: row.images[0] ? this.image(row.images[0]) : null,
      locationName: row.location?.name ?? '',
      distanceKm: opts.distanceKm ?? null,
      publishedAt: row.publishedAt?.toISOString() ?? null,
      isFavorite: opts.isFavorite ?? false,
    };
  }
}
