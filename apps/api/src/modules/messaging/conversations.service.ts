import { ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Message, Notification, Prisma, User } from '@prisma/client';
import { ChatMessage, ConversationSummary, listingPath } from '@sellnest/shared';
import { paginated } from '../../common/dtos';
import { PrismaService } from '../../common/prisma.service';
import { ListingMapper } from '../listings/listing.mapper';
import { NotificationsService } from '../notifications/notifications.service';
import { RealtimeService } from '../realtime/realtime.service';

const SUMMARY_INCLUDE = {
  listing: { include: { images: { orderBy: { position: 'asc' }, take: 1 } } },
  buyer: true,
  seller: true,
  participants: true,
  messages: { orderBy: { createdAt: 'desc' }, take: 1 },
} satisfies Prisma.ConversationInclude;

type SummaryRow = Prisma.ConversationGetPayload<{ include: typeof SUMMARY_INCLUDE }>;

export function toChatMessage(m: Message): ChatMessage {
  return {
    id: m.id,
    conversationId: m.conversationId,
    senderId: m.senderId,
    type: m.type,
    body: m.body,
    createdAt: m.createdAt.toISOString(),
  };
}

@Injectable()
export class ConversationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mapper: ListingMapper,
    private readonly notifications: NotificationsService,
    private readonly realtime: RealtimeService,
  ) {}

  private async assertNotBlocked(a: string, b: string, tx: Prisma.TransactionClient = this.prisma) {
    const block = await tx.block.findFirst({
      where: {
        OR: [
          { blockerId: a, blockedId: b },
          { blockerId: b, blockedId: a },
        ],
      },
    });
    if (block) throw new ForbiddenException({ code: 'BLOCKED', message: 'You cannot message this person' });
  }

  /** Idempotent, so offers and "Contact seller" share one thread per buyer per listing. */
  async ensure(tx: Prisma.TransactionClient, listingId: string, buyerId: string, sellerId: string) {
    const conversation = await tx.conversation.upsert({
      where: { listingId_buyerId: { listingId, buyerId } },
      create: { listingId, buyerId, sellerId },
      update: {},
    });
    await tx.conversationParticipant.createMany({
      data: [
        { conversationId: conversation.id, userId: buyerId },
        { conversationId: conversation.id, userId: sellerId },
      ],
      skipDuplicates: true,
    });
    return conversation;
  }

  async start(user: User, listingId: string, message?: string) {
    const listing = await this.prisma.listing.findFirst({ where: { id: listingId, deletedAt: null } });
    if (!listing) throw new NotFoundException('Listing not found');
    if (listing.sellerId === user.id) throw new ConflictException('You cannot message yourself about your own listing');
    await this.assertNotBlocked(user.id, listing.sellerId);
    const existing = await this.prisma.conversation.findUnique({
      where: { listingId_buyerId: { listingId, buyerId: user.id } },
    });
    // Only a live listing can start a new thread; existing threads stay usable after a sale.
    if (!existing && listing.status !== 'ACTIVE') throw new ConflictException('This listing is no longer available');
    const conversation = await this.prisma.$transaction((tx) => this.ensure(tx, listingId, user.id, listing.sellerId));
    if (message) await this.send(user, conversation.id, message);
    return { id: conversation.id };
  }

  private async participantConversation(conversationId: string, userId: string) {
    const conversation = await this.prisma.conversation.findFirst({
      where: { id: conversationId, participants: { some: { userId } } },
    });
    // Same answer as a missing thread, so ids cannot be probed.
    if (!conversation) throw new NotFoundException('Conversation not found');
    return conversation;
  }

  private async toSummaries(rows: SummaryRow[], userId: string): Promise<ConversationSummary[]> {
    const otherIds = rows.map((c) => (c.buyerId === userId ? c.sellerId : c.buyerId));
    const blocks = await this.prisma.block.findMany({
      where: {
        OR: [
          { blockerId: userId, blockedId: { in: otherIds } },
          { blockedId: userId, blockerId: { in: otherIds } },
        ],
      },
    });
    const blocked = new Set(blocks.map((b) => (b.blockerId === userId ? b.blockedId : b.blockerId)));
    return rows.map((c) => {
      const role = c.buyerId === userId ? 'buyer' : 'seller';
      const other = role === 'buyer' ? c.seller : c.buyer;
      const mine = c.participants.find((p) => p.userId === userId);
      const theirs = c.participants.find((p) => p.userId === other.id);
      const last = c.messages[0];
      return {
        id: c.id,
        listing: {
          id: c.listing.id,
          path: listingPath(c.listing),
          title: c.listing.title ?? 'Untitled',
          priceBdt: c.listing.priceBdt ?? 0,
          status: c.listing.status,
          cover: c.listing.images[0] ? this.mapper.image(c.listing.images[0]) : null,
        },
        other: this.mapper.user(other),
        role,
        lastMessage: last ? { body: last.body, createdAt: last.createdAt.toISOString(), senderId: last.senderId } : null,
        unreadCount: mine?.unreadCount ?? 0,
        otherLastReadAt: theirs?.lastReadAt.toISOString() ?? null,
        blocked: blocked.has(other.id),
      };
    });
  }

  async list(userId: string, page: number, limit: number) {
    const where: Prisma.ConversationWhereInput = { participants: { some: { userId } } };
    const [rows, total] = await Promise.all([
      this.prisma.conversation.findMany({
        where,
        orderBy: { lastMessageAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: SUMMARY_INCLUDE,
      }),
      this.prisma.conversation.count({ where }),
    ]);
    return paginated(await this.toSummaries(rows, userId), total, page, limit);
  }

  async get(id: string, userId: string) {
    await this.participantConversation(id, userId);
    const row = await this.prisma.conversation.findUniqueOrThrow({ where: { id }, include: SUMMARY_INCLUDE });
    const [summary] = await this.toSummaries([row], userId);
    return summary!;
  }

  /** Newest first, with cursor paging on createdAt so new messages cannot shift pages. */
  async messages(id: string, userId: string, before: string | undefined, limit: number) {
    await this.participantConversation(id, userId);
    const rows = await this.prisma.message.findMany({
      where: { conversationId: id, ...(before ? { createdAt: { lt: new Date(before) } } : {}) },
      orderBy: { createdAt: 'desc' },
      take: limit + 1,
    });
    return { items: rows.slice(0, limit).map(toChatMessage), hasMore: rows.length > limit };
  }

  async send(user: User, id: string, body: string) {
    const conversation = await this.participantConversation(id, user.id);
    const recipientId = conversation.buyerId === user.id ? conversation.sellerId : conversation.buyerId;
    await this.assertNotBlocked(user.id, recipientId);
    let notification: Notification | null = null;
    const message = await this.prisma.$transaction(async (tx) => {
      const created = await tx.message.create({ data: { conversationId: id, senderId: user.id, body } });
      await tx.conversation.update({ where: { id }, data: { lastMessageAt: created.createdAt } });
      const recipient = await tx.conversationParticipant.update({
        where: { conversationId_userId: { conversationId: id, userId: recipientId } },
        data: { unreadCount: { increment: 1 } },
      });
      // One notification per unread run, so a chatty thread does not flood the bell.
      if (recipient.unreadCount === 1) {
        notification = await this.notifications.create(tx, {
          userId: recipientId,
          type: 'NEW_MESSAGE',
          title: `New message from ${user.displayName}`,
          body: body.slice(0, 120),
          href: `/inbox/${id}`,
        });
      }
      return created;
    });
    const payload = toChatMessage(message);
    this.realtime.toUser(recipientId, 'message:new', payload);
    this.realtime.toUser(user.id, 'message:new', payload);
    if (notification) this.notifications.push(notification);
    return payload;
  }

  /** Records an offer event in the thread, inside the offer's transaction. */
  async addSystemMessage(tx: Prisma.TransactionClient, conversationId: string, recipientId: string, body: string) {
    const message = await tx.message.create({ data: { conversationId, type: 'SYSTEM', body } });
    await tx.conversation.update({ where: { id: conversationId }, data: { lastMessageAt: message.createdAt } });
    await tx.conversationParticipant.update({
      where: { conversationId_userId: { conversationId, userId: recipientId } },
      data: { unreadCount: { increment: 1 } },
    });
    return toChatMessage(message);
  }

  async markRead(id: string, userId: string) {
    const conversation = await this.participantConversation(id, userId);
    const lastReadAt = new Date();
    await this.prisma.conversationParticipant.update({
      where: { conversationId_userId: { conversationId: id, userId } },
      data: { unreadCount: 0, lastReadAt },
    });
    const otherId = conversation.buyerId === userId ? conversation.sellerId : conversation.buyerId;
    const payload = { conversationId: id, userId, lastReadAt: lastReadAt.toISOString() };
    this.realtime.toUser(otherId, 'conversation:read', payload);
    this.realtime.toUser(userId, 'conversation:read', payload);
  }
}
