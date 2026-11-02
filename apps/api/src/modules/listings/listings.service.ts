import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ListingStatus, Notification, Prisma, User } from '@prisma/client';
import {
  ListingDetail,
  ListingDraftInput,
  ListingEditable,
  listingPath,
  MyListing,
  publishableListingSchema,
} from '@sellnest/shared';
import { paginated } from '../../common/dtos';
import { PrismaService } from '../../common/prisma.service';
import { RedisService } from '../../common/redis.service';
import { SettingsService } from '../../common/settings.service';
import { EDITABLE_STATUSES, matchProhibitedKeyword, ownerCanTransition, PUBLIC_STATUSES } from '../../domain/listing-state';
import { OPEN_OFFER_STATUSES } from '../../domain/offer-state';
import { NotificationsService } from '../notifications/notifications.service';
import { ListingMapper } from './listing.mapper';

const MAX_DRAFTS = 20;
const STAFF = new Set(['MODERATOR', 'ADMIN']);

@Injectable()
export class ListingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly settings: SettingsService,
    private readonly mapper: ListingMapper,
    private readonly notifications: NotificationsService,
  ) {}

  private async owned(id: string, userId: string) {
    const listing = await this.prisma.listing.findFirst({ where: { id, deletedAt: null } });
    if (!listing) throw new NotFoundException('Listing not found');
    if (listing.sellerId !== userId) throw new ForbiddenException('This is not your listing');
    return listing;
  }

  async createDraft(user: User) {
    const drafts = await this.prisma.listing.count({ where: { sellerId: user.id, status: 'DRAFT', deletedAt: null } });
    if (drafts >= MAX_DRAFTS) {
      throw new ConflictException(`You have ${MAX_DRAFTS} drafts. Finish or delete one first.`);
    }
    const listing = await this.prisma.listing.create({
      data: { sellerId: user.id, status: 'DRAFT', locationId: user.locationId },
    });
    if (user.locationId) await this.syncCoordinates(listing.id, user.locationId);
    return this.editable(listing.id, user.id);
  }

  private async syncCoordinates(listingId: string, locationId: string, tx: Prisma.TransactionClient = this.prisma) {
    const location = await tx.location.findFirst({ where: { id: locationId, isActive: true } });
    if (!location) throw new BadRequestException('Choose a valid location');
    await tx.listing.update({
      where: { id: listingId },
      data: { latitude: location.latitude, longitude: location.longitude },
    });
  }

  async editable(id: string, userId: string): Promise<ListingEditable> {
    await this.owned(id, userId);
    const l = await this.prisma.listing.findUniqueOrThrow({
      where: { id },
      include: { images: { orderBy: { position: 'asc' } } },
    });
    return {
      id: l.id,
      status: l.status,
      title: l.title,
      description: l.description,
      categoryId: l.categoryId,
      condition: l.condition,
      brand: l.brand,
      model: l.model,
      priceBdt: l.priceBdt,
      originalPriceBdt: l.originalPriceBdt,
      negotiable: l.negotiable,
      locationId: l.locationId,
      meetupAvailable: l.meetupAvailable,
      deliveryAvailable: l.deliveryAvailable,
      images: l.images.map((i) => this.mapper.image(i)),
      rejectionReason: l.rejectionReason,
      updatedAt: l.updatedAt.toISOString(),
      path: listingPath(l),
    };
  }

  async update(id: string, user: User, dto: ListingDraftInput) {
    const listing = await this.owned(id, user.id);
    if (!EDITABLE_STATUSES.includes(listing.status)) {
      throw new ConflictException('Sold and archived listings cannot be edited');
    }
    const { imageIds, ...fields } = dto;
    if (fields.categoryId) await this.assertCategory(fields.categoryId);

    await this.prisma.$transaction(async (tx) => {
      const updated = await tx.listing.update({
        where: { id },
        data: { ...fields, ...(fields.locationId === null ? { latitude: null, longitude: null } : {}) },
      });
      if (fields.locationId) await this.syncCoordinates(id, fields.locationId, tx);
      if (imageIds) await this.setImages(tx, id, user.id, imageIds);
      // A live listing must stay publishable, and edits get the same policy check as publishing.
      if (updated.status === 'ACTIVE' || updated.status === 'PAUSED') {
        const imageCount = await tx.listingImage.count({ where: { listingId: id } });
        this.assertPublishable(updated, imageCount);
        const flag = await this.policyFlag(updated);
        if (flag) {
          await tx.listing.update({ where: { id }, data: { status: 'PENDING_REVIEW', flagReason: flag } });
        }
      }
    });
    return this.editable(id, user.id);
  }

  private async assertCategory(categoryId: string) {
    const category = await this.prisma.category.findFirst({ where: { id: categoryId, isActive: true } });
    if (!category) throw new BadRequestException('Choose a valid category');
  }

  private async setImages(tx: Prisma.TransactionClient, listingId: string, userId: string, imageIds: string[]) {
    const { maxListingImages } = await this.settings.get();
    if (imageIds.length > maxListingImages) {
      throw new BadRequestException(`A listing can have at most ${maxListingImages} photos`);
    }
    const images = await tx.listingImage.findMany({ where: { id: { in: imageIds } } });
    const valid = images.filter((i) => i.uploaderId === userId && (i.listingId === null || i.listingId === listingId));
    if (valid.length !== new Set(imageIds).size) throw new BadRequestException('One of those photos cannot be used');
    await tx.listingImage.updateMany({
      where: { listingId, id: { notIn: imageIds } },
      data: { listingId: null, createdAt: new Date() },
    });
    await Promise.all(
      imageIds.map((imageId, position) => tx.listingImage.update({ where: { id: imageId }, data: { listingId, position } })),
    );
  }

  private assertPublishable(
    listing: Pick<Prisma.ListingUncheckedCreateInput, 'title' | 'description' | 'categoryId' | 'condition' | 'priceBdt' | 'locationId'>,
    imageCount: number,
  ) {
    const parsed = publishableListingSchema.safeParse({
      title: listing.title,
      description: listing.description,
      categoryId: listing.categoryId,
      condition: listing.condition,
      priceBdt: listing.priceBdt,
      locationId: listing.locationId,
      imageCount,
    });
    if (!parsed.success) {
      const details = parsed.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message }));
      throw new HttpException(
        { code: 'LISTING_INCOMPLETE', message: 'Finish the missing details before publishing', details },
        HttpStatus.UNPROCESSABLE_ENTITY,
      );
    }
  }

  private async policyFlag(listing: { title: string | null; description: string | null; brand: string | null; model: string | null }) {
    const { prohibitedKeywords } = await this.settings.get();
    const text = [listing.title, listing.description, listing.brand, listing.model].filter(Boolean).join(' ');
    const match = matchProhibitedKeyword(text, prohibitedKeywords);
    return match ? `Matched policy keyword: ${match}` : null;
  }

  async publish(id: string, user: User) {
    if (!user.emailVerifiedAt) {
      throw new ForbiddenException({ code: 'EMAIL_NOT_VERIFIED', message: 'Verify your email before publishing' });
    }
    const listing = await this.owned(id, user.id);
    if (!['DRAFT', 'REJECTED'].includes(listing.status)) {
      throw new ConflictException('This listing is already published');
    }
    const imageCount = await this.prisma.listingImage.count({ where: { listingId: id } });
    this.assertPublishable(listing, imageCount);

    const settings = await this.settings.get();
    const since = new Date(Date.now() - 86_400_000);
    const recent = await this.prisma.listing.count({
      // Submissions awaiting review count too, or new accounts could queue without limit.
      where: {
        sellerId: user.id,
        OR: [{ publishedAt: { gte: since } }, { status: 'PENDING_REVIEW', updatedAt: { gte: since } }],
      },
    });
    if (recent >= settings.dailyPublishLimit) {
      throw new HttpException(
        { code: 'RATE_LIMITED', message: `You can publish ${settings.dailyPublishLimit} listings per day. Try again tomorrow.` },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const flag = await this.policyFlag(listing);
    const accountAgeDays = (Date.now() - user.createdAt.getTime()) / 86_400_000;
    const isStaff = STAFF.has(user.role);
    const needsReview =
      listing.status === 'REJECTED' || Boolean(flag) || (!isStaff && accountAgeDays < settings.newAccountReviewDays);
    const status: ListingStatus = needsReview ? 'PENDING_REVIEW' : 'ACTIVE';

    // Guarded on the expected status so a double-click or second tab cannot publish twice.
    const claimed = await this.prisma.listing.updateMany({
      where: { id, status: listing.status },
      data: {
        status,
        flagReason: flag,
        rejectionReason: null,
        publishedAt: status === 'ACTIVE' ? new Date() : null,
      },
    });
    if (claimed.count !== 1) throw new ConflictException('This listing was just changed. Refresh and try again.');
    return { status };
  }

  /** Locks the listing row so status changes serialize against offers being made or accepted. */
  private lockListing(tx: Prisma.TransactionClient, id: string) {
    return tx.$queryRaw`SELECT 1 FROM "Listing" WHERE "id" = ${id}::uuid FOR UPDATE`;
  }

  /** Closes every live negotiation, accepted ones included, except the confirmed buyer's accepted offer. */
  private async expireOpenOffers(tx: Prisma.TransactionClient, listingId: string, actorId: string, keepBuyerId?: string | null) {
    const open = await tx.offer.findMany({
      where: {
        listingId,
        OR: [
          { status: { in: OPEN_OFFER_STATUSES } },
          { status: 'ACCEPTED', ...(keepBuyerId ? { buyerId: { not: keepBuyerId } } : {}) },
        ],
      },
      select: { id: true, buyerId: true },
    });
    if (open.length === 0) return open;
    await tx.offer.updateMany({ where: { id: { in: open.map((o) => o.id) } }, data: { status: 'EXPIRED' } });
    await tx.offerEvent.createMany({ data: open.map((o) => ({ offerId: o.id, actorId, type: 'EXPIRED' })) });
    return open;
  }

  async markSold(id: string, user: User, soldToUserId?: string | null, soldPriceBdt?: number | null) {
    const created: Notification[] = [];
    await this.prisma.$transaction(async (tx) => {
      await this.lockListing(tx, id);
      const listing = await tx.listing.findFirst({ where: { id, deletedAt: null } });
      if (!listing) throw new NotFoundException('Listing not found');
      if (listing.sellerId !== user.id) throw new ForbiddenException('This is not your listing');
      if (!ownerCanTransition(listing.status, 'SOLD')) {
        throw new ConflictException('Only active or paused listings can be marked as sold');
      }
      if (soldToUserId) {
        // The named buyer must really have talked to the seller about this item.
        const conversation = await tx.conversation.findUnique({
          where: { listingId_buyerId: { listingId: id, buyerId: soldToUserId } },
        });
        if (!conversation) throw new BadRequestException('Choose a buyer who messaged you about this listing');
      }
      await tx.listing.update({
        where: { id },
        data: { status: 'SOLD', soldAt: new Date(), soldToUserId: soldToUserId ?? null, soldPriceBdt: soldPriceBdt ?? null },
      });
      const expired = await this.expireOpenOffers(tx, id, user.id, soldToUserId);
      const title = listing.title ?? 'A listing';
      const recipients = new Set(expired.map((o) => o.buyerId));
      if (soldToUserId) recipients.delete(soldToUserId);
      for (const userId of recipients) {
        created.push(
          await this.notifications.create(tx, {
            userId,
            type: 'LISTING_SOLD',
            title: `${title} was sold`,
            body: 'Your open offer has closed.',
            href: '/account/offers',
          }),
        );
      }
      if (soldToUserId) {
        created.push(
          await this.notifications.create(tx, {
            userId: soldToUserId,
            type: 'LISTING_SOLD',
            title: `${user.displayName} marked ${title} as sold to you`,
            body: 'You can now review this seller.',
            href: '/account/offers',
          }),
        );
      }
    });
    created.forEach((n) => this.notifications.push(n));
    return { status: 'SOLD' as const };
  }

  async applyAction(id: string, user: User, action: 'pause' | 'reactivate' | 'archive') {
    const target: ListingStatus = { pause: 'PAUSED', reactivate: 'ACTIVE', archive: 'ARCHIVED' }[action] as ListingStatus;
    await this.prisma.$transaction(async (tx) => {
      await this.lockListing(tx, id);
      const listing = await tx.listing.findFirst({ where: { id, deletedAt: null } });
      if (!listing) throw new NotFoundException('Listing not found');
      if (listing.sellerId !== user.id) throw new ForbiddenException('This is not your listing');
      if (!ownerCanTransition(listing.status, target)) {
        throw new ConflictException(`A ${listing.status.toLowerCase().replace('_', ' ')} listing cannot do that`);
      }
      await tx.listing.update({ where: { id }, data: { status: target } });
      if (target === 'ARCHIVED') await this.expireOpenOffers(tx, id, user.id);
    });
    return { status: target };
  }

  /** Soft delete. Photos are released to the cleanup job; favorites are removed immediately. */
  async remove(id: string, user: User) {
    await this.prisma.$transaction(async (tx) => {
      await this.lockListing(tx, id);
      const listing = await tx.listing.findFirst({ where: { id, deletedAt: null } });
      if (!listing) throw new NotFoundException('Listing not found');
      if (listing.sellerId !== user.id) throw new ForbiddenException('This is not your listing');
      await this.expireOpenOffers(tx, id, user.id);
      await tx.favorite.deleteMany({ where: { listingId: id } });
      await tx.listingImage.updateMany({ where: { listingId: id }, data: { listingId: null, createdAt: new Date() } });
      await tx.listing.update({ where: { id }, data: { deletedAt: new Date(), status: 'ARCHIVED' } });
    });
  }

  /** Distance from the viewer's chosen area, or null when that area is unknown or has no point. */
  private async distanceFrom(id: string, locationSlug?: string): Promise<number | null> {
    if (!locationSlug) return null;
    const rows = await this.prisma.$queryRaw<{ distance_m: number | null }[]>(Prisma.sql`
      SELECT ST_Distance(l."geo", loc."geo") AS distance_m
      FROM "Listing" l, "Location" loc
      WHERE l."id" = ${id}::uuid AND loc."slug" = ${locationSlug}`);
    const metres = rows[0]?.distance_m;
    return metres == null ? null : Math.round(metres / 100) / 10;
  }

  async detail(id: string, viewer?: User, locationSlug?: string): Promise<ListingDetail> {
    const l = await this.prisma.listing.findFirst({
      where: { id, deletedAt: null },
      include: {
        images: { orderBy: { position: 'asc' } },
        location: true,
        category: { include: { parent: { select: { slug: true, name: true } } } },
        seller: true,
      },
    });
    if (!l) throw new NotFoundException('Listing not found');
    const isOwner = viewer?.id === l.sellerId;
    const isStaff = viewer ? STAFF.has(viewer.role) : false;
    const visible = isOwner || isStaff || (PUBLIC_STATUSES.includes(l.status) && l.seller.status === 'ACTIVE');
    if (!visible || !l.location || !l.category) {
      // Incomplete drafts have nothing to show even to their owner; they use the edit view.
      throw new NotFoundException('Listing not found');
    }
    const [distanceKm, reviews, favorite, conversation, openOffer] = await Promise.all([
      this.distanceFrom(id, locationSlug),
      this.prisma.review.aggregate({ where: { revieweeId: l.sellerId }, _count: true, _avg: { rating: true } }),
      viewer ? this.prisma.favorite.findUnique({ where: { userId_listingId: { userId: viewer.id, listingId: id } } }) : null,
      viewer && !isOwner
        ? this.prisma.conversation.findUnique({ where: { listingId_buyerId: { listingId: id, buyerId: viewer.id } }, select: { id: true } })
        : null,
      viewer && !isOwner
        ? this.prisma.offer.findFirst({
            where: { listingId: id, buyerId: viewer.id, status: { in: [...OPEN_OFFER_STATUSES, 'ACCEPTED'] } },
            orderBy: { createdAt: 'desc' },
          })
        : null,
    ]);
    return {
      ...this.mapper.card({ ...l, images: l.images.slice(0, 1) }, { distanceKm, isFavorite: Boolean(favorite) }),
      description: l.description ?? '',
      images: l.images.map((i) => this.mapper.image(i)),
      originalPriceBdt: l.originalPriceBdt,
      brand: l.brand,
      model: l.model,
      category: { id: l.category.id, slug: l.category.slug, name: l.category.name, parent: l.category.parent },
      location: { id: l.location.id, slug: l.location.slug, name: l.location.name, type: l.location.type },
      meetupAvailable: l.meetupAvailable,
      deliveryAvailable: l.deliveryAvailable,
      seller: {
        ...this.mapper.user(l.seller),
        memberSince: l.seller.createdAt.toISOString(),
        reviewCount: reviews._count,
        averageRating: reviews._avg.rating,
      },
      isOwner,
      isDemo: l.isDemo,
      viewerConversationId: conversation?.id ?? null,
      viewerOpenOffer: openOffer
        ? {
            id: openOffer.id,
            amountBdt: openOffer.amountBdt,
            note: openOffer.note,
            status: openOffer.status,
            buyerId: openOffer.buyerId,
            sellerId: openOffer.sellerId,
            createdAt: openOffer.createdAt.toISOString(),
            updatedAt: openOffer.updatedAt.toISOString(),
          }
        : null,
      rejectionReason: isOwner || isStaff ? l.rejectionReason : null,
    };
  }

  /** Counts one view per viewer per listing per hour; the owner's own views are ignored. */
  async recordView(id: string, viewerKey: string, viewerId?: string) {
    const first = await this.redis.client.set(`view:${id}:${viewerKey}`, '1', 'EX', 3600, 'NX').catch(() => null);
    if (!first) return;
    await this.prisma.listing.updateMany({
      where: { id, status: 'ACTIVE', ...(viewerId ? { sellerId: { not: viewerId } } : {}) },
      data: { viewCount: { increment: 1 } },
    });
  }

  async mine(userId: string, status: ListingStatus | undefined, page: number, limit: number) {
    const where: Prisma.ListingWhereInput = { sellerId: userId, deletedAt: null, ...(status ? { status } : {}) };
    const [rows, total] = await Promise.all([
      this.prisma.listing.findMany({
        where,
        orderBy: { updatedAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          images: { orderBy: { position: 'asc' }, take: 1 },
          _count: {
            select: {
              favorites: true,
              conversations: true,
              offers: { where: { status: { in: OPEN_OFFER_STATUSES } } },
            },
          },
        },
      }),
      this.prisma.listing.count({ where }),
    ]);
    const items: MyListing[] = rows.map((l) => ({
      id: l.id,
      path: listingPath(l),
      title: l.title,
      priceBdt: l.priceBdt,
      status: l.status,
      cover: l.images[0] ? this.mapper.image(l.images[0]) : null,
      viewCount: l.viewCount,
      favoriteCount: l._count.favorites,
      openOfferCount: l._count.offers,
      conversationCount: l._count.conversations,
      rejectionReason: l.rejectionReason,
      updatedAt: l.updatedAt.toISOString(),
    }));
    return paginated(items, total, page, limit);
  }

  /** People the seller can name as the buyer when marking a listing sold. */
  async potentialBuyers(id: string, userId: string) {
    await this.owned(id, userId);
    const conversations = await this.prisma.conversation.findMany({
      where: { listingId: id },
      orderBy: { lastMessageAt: 'desc' },
      include: { buyer: true },
    });
    return conversations.map((c) => this.mapper.user(c.buyer));
  }

  async setFavorite(listingId: string, userId: string, favorite: boolean) {
    if (!favorite) {
      await this.prisma.favorite.deleteMany({ where: { userId, listingId } });
      return { isFavorite: false };
    }
    const listing = await this.prisma.listing.findFirst({
      where: { id: listingId, deletedAt: null, status: { in: PUBLIC_STATUSES } },
      select: { id: true },
    });
    if (!listing) throw new NotFoundException('Listing not found');
    await this.prisma.favorite.upsert({
      where: { userId_listingId: { userId, listingId } },
      create: { userId, listingId },
      update: {},
    });
    return { isFavorite: true };
  }

  async favorites(userId: string, page: number, limit: number) {
    const where: Prisma.FavoriteWhereInput = { userId, listing: { deletedAt: null } };
    const [rows, total] = await Promise.all([
      this.prisma.favorite.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          listing: {
            include: { images: { orderBy: { position: 'asc' }, take: 1 }, location: { select: { name: true } } },
          },
        },
      }),
      this.prisma.favorite.count({ where }),
    ]);
    return paginated(rows.map((f) => this.mapper.card(f.listing, { isFavorite: true })), total, page, limit);
  }
}
