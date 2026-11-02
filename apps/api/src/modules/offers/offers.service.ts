import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Notification, NotificationType, OfferStatus, Prisma, User } from '@prisma/client';
import { ChatMessage, formatBdt, listingPath, OfferDetail } from '@sellnest/shared';
import { paginated } from '../../common/dtos';
import { PrismaService } from '../../common/prisma.service';
import { nextOfferStatus, OfferAction, OfferActor, OPEN_OFFER_STATUSES } from '../../domain/offer-state';
import { ListingMapper } from '../listings/listing.mapper';
import { ConversationsService } from '../messaging/conversations.service';
import { NotificationsService } from '../notifications/notifications.service';
import { RealtimeService } from '../realtime/realtime.service';

const DETAIL_INCLUDE = {
  listing: { include: { images: { orderBy: { position: 'asc' }, take: 1 } } },
  buyer: true,
  seller: true,
  events: { orderBy: { createdAt: 'asc' } },
} satisfies Prisma.OfferInclude;
type DetailRow = Prisma.OfferGetPayload<{ include: typeof DETAIL_INCLUDE }>;

const ACTION_COPY: Record<OfferAction, { verb: string; type: NotificationType }> = {
  accept: { verb: 'accepted', type: 'OFFER_ACCEPTED' },
  reject: { verb: 'rejected', type: 'OFFER_REJECTED' },
  counter: { verb: 'countered', type: 'OFFER_COUNTERED' },
  cancel: { verb: 'cancelled', type: 'OFFER_CANCELLED' },
};

const isUniqueViolation = (e: unknown) => e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002';

interface SideEffects {
  notification: Notification;
  recipientId: string;
  actorId: string;
  message: ChatMessage;
}

@Injectable()
export class OffersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly conversations: ConversationsService,
    private readonly notifications: NotificationsService,
    private readonly realtime: RealtimeService,
    private readonly mapper: ListingMapper,
  ) {}

  private lockListing(tx: Prisma.TransactionClient, id: string) {
    return tx.$queryRaw`SELECT 1 FROM "Listing" WHERE "id" = ${id}::uuid FOR UPDATE`;
  }

  /** Socket and notification pushes happen after commit, so nobody sees a rolled-back event. */
  private publish(effects: SideEffects) {
    this.notifications.push(effects.notification);
    this.realtime.toUser(effects.recipientId, 'message:new', effects.message);
    this.realtime.toUser(effects.actorId, 'message:new', effects.message);
  }

  async create(user: User, listingId: string, amountBdt: number, note?: string) {
    let effects: SideEffects | undefined;
    try {
      const offerId = await this.prisma.$transaction(async (tx) => {
        await this.lockListing(tx, listingId);
        const listing = await tx.listing.findFirst({ where: { id: listingId, deletedAt: null } });
        if (!listing) throw new NotFoundException('Listing not found');
        if (listing.sellerId === user.id) throw new ConflictException('You cannot make an offer on your own listing');
        if (listing.status !== 'ACTIVE') throw new ConflictException('This listing is no longer available');
        if (!listing.negotiable) throw new ConflictException('This listing has a fixed price');
        const block = await tx.block.findFirst({
          where: {
            OR: [
              { blockerId: user.id, blockedId: listing.sellerId },
              { blockerId: listing.sellerId, blockedId: user.id },
            ],
          },
        });
        if (block) throw new ForbiddenException({ code: 'BLOCKED', message: 'You cannot make an offer on this listing' });

        const offer = await tx.offer.create({
          data: { listingId, buyerId: user.id, sellerId: listing.sellerId, amountBdt, note },
        });
        await tx.offerEvent.create({ data: { offerId: offer.id, actorId: user.id, type: 'CREATED', amountBdt } });
        const conversation = await this.conversations.ensure(tx, listingId, user.id, listing.sellerId);
        const message = await this.conversations.addSystemMessage(
          tx,
          conversation.id,
          listing.sellerId,
          `${user.displayName} offered ${formatBdt(amountBdt)}${note ? `: ${note}` : ''}`,
        );
        const notification = await this.notifications.create(tx, {
          userId: listing.sellerId,
          type: 'NEW_OFFER',
          title: `${user.displayName} offered ${formatBdt(amountBdt)}`,
          body: listing.title ?? undefined,
          href: '/account/offers?role=seller',
        });
        effects = { notification, recipientId: listing.sellerId, actorId: user.id, message };
        return offer.id;
      });
      if (effects) this.publish(effects);
      return this.detail(offerId, user.id);
    } catch (e) {
      if (isUniqueViolation(e)) throw new ConflictException('You already have an open offer on this listing');
      throw e;
    }
  }

  /** Reads and writes under the listing lock, so two simultaneous responses cannot both apply. */
  async act(user: User, offerId: string, action: OfferAction, amountBdt?: number) {
    const peek = await this.prisma.offer.findUnique({ where: { id: offerId }, select: { listingId: true } });
    if (!peek) throw new NotFoundException('Offer not found');
    let effects: SideEffects | undefined;
    try {
      await this.prisma.$transaction(async (tx) => {
        await this.lockListing(tx, peek.listingId);
        const offer = await tx.offer.findUniqueOrThrow({ where: { id: offerId }, include: { listing: true } });
        const actor: OfferActor | null = offer.buyerId === user.id ? 'buyer' : offer.sellerId === user.id ? 'seller' : null;
        if (!actor) throw new NotFoundException('Offer not found');
        const next = nextOfferStatus(offer.status, actor, action);
        if (!next) throw new ConflictException(`This offer can no longer be ${ACTION_COPY[action].verb}`);
        if (action === 'counter' && !amountBdt) throw new BadRequestException('Enter a counter amount');
        if ((action === 'accept' || action === 'counter') && offer.listing.status !== 'ACTIVE') {
          throw new ConflictException('This listing is no longer available');
        }

        const amount = action === 'counter' ? amountBdt! : offer.amountBdt;
        await tx.offer.update({ where: { id: offerId }, data: { status: next as OfferStatus, amountBdt: amount } });
        await tx.offerEvent.create({
          data: { offerId, actorId: user.id, type: action.toUpperCase(), amountBdt: amount },
        });

        const recipientId = actor === 'buyer' ? offer.sellerId : offer.buyerId;
        const conversation = await this.conversations.ensure(tx, offer.listingId, offer.buyerId, offer.sellerId);
        const { verb, type } = ACTION_COPY[action];
        const summary =
          action === 'counter'
            ? `${user.displayName} countered with ${formatBdt(amount)}`
            : `${user.displayName} ${verb} the offer of ${formatBdt(amount)}`;
        const message = await this.conversations.addSystemMessage(tx, conversation.id, recipientId, summary);
        const notification = await this.notifications.create(tx, {
          userId: recipientId,
          type,
          title: summary,
          body: offer.listing.title ?? undefined,
          href: `/account/offers?role=${actor === 'buyer' ? 'seller' : 'buyer'}`,
        });
        effects = { notification, recipientId, actorId: user.id, message };
      });
    } catch (e) {
      if (isUniqueViolation(e)) throw new ConflictException('Another offer on this listing has already been accepted');
      throw e;
    }
    if (effects) this.publish(effects);
    return this.detail(offerId, user.id);
  }

  private toDetail(o: DetailRow, conversationId: string | null): OfferDetail {
    return {
      id: o.id,
      amountBdt: o.amountBdt,
      note: o.note,
      status: o.status,
      buyerId: o.buyerId,
      sellerId: o.sellerId,
      createdAt: o.createdAt.toISOString(),
      updatedAt: o.updatedAt.toISOString(),
      listing: {
        id: o.listing.id,
        path: listingPath(o.listing),
        title: o.listing.title ?? 'Untitled',
        status: o.listing.status,
        priceBdt: o.listing.priceBdt ?? 0,
        cover: o.listing.images[0] ? this.mapper.image(o.listing.images[0]) : null,
      },
      buyer: this.mapper.user(o.buyer),
      seller: this.mapper.user(o.seller),
      conversationId,
      events: o.events.map((e) => ({
        id: e.id,
        type: e.type,
        amountBdt: e.amountBdt,
        actorId: e.actorId,
        createdAt: e.createdAt.toISOString(),
      })),
    };
  }

  private async withConversations(rows: DetailRow[]) {
    const conversations = await this.prisma.conversation.findMany({
      where: { OR: rows.map((o) => ({ listingId: o.listingId, buyerId: o.buyerId })) },
      select: { id: true, listingId: true, buyerId: true },
    });
    const byKey = new Map(conversations.map((c) => [`${c.listingId}:${c.buyerId}`, c.id]));
    return rows.map((o) => this.toDetail(o, byKey.get(`${o.listingId}:${o.buyerId}`) ?? null));
  }

  async detail(id: string, userId: string) {
    const row = await this.prisma.offer.findFirst({
      where: { id, OR: [{ buyerId: userId }, { sellerId: userId }] },
      include: DETAIL_INCLUDE,
    });
    if (!row) throw new NotFoundException('Offer not found');
    const [offer] = await this.withConversations([row]);
    return offer!;
  }

  async list(userId: string, role: 'buyer' | 'seller', status: OfferStatus | undefined, page: number, limit: number) {
    const where: Prisma.OfferWhereInput = {
      ...(role === 'buyer' ? { buyerId: userId } : { sellerId: userId }),
      ...(status ? { status } : {}),
    };
    const [rows, total] = await Promise.all([
      this.prisma.offer.findMany({
        where,
        orderBy: { updatedAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: DETAIL_INCLUDE,
      }),
      this.prisma.offer.count({ where }),
    ]);
    return paginated(rows.length ? await this.withConversations(rows) : [], total, page, limit);
  }
}

export { OPEN_OFFER_STATUSES };
