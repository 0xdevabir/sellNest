import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  ForbiddenException,
  Get,
  Injectable,
  NotFoundException,
  Post,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Prisma, User } from '@prisma/client';
import { CreateReportInput, listingPath } from '@sellnest/shared';
import { AuthUser, CurrentUser, RateLimit, VerifiedOnly } from '../../common/auth.decorators';
import { CreateReportDto, CreateReviewDto } from '../../common/dtos';
import { PrismaService } from '../../common/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class TrustService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  async report(user: User, input: CreateReportInput) {
    const fields = await this.resolveTarget(user.id, input);
    // A repeat report from the same person adds work for moderators and no information.
    const duplicate = await this.prisma.report.findFirst({
      where: { reporterId: user.id, targetType: input.targetType, status: 'OPEN', ...fields },
      select: { id: true },
    });
    if (duplicate) throw new ConflictException('You have already reported this. Our team will review it.');
    await this.prisma.report.create({
      data: { reporterId: user.id, targetType: input.targetType, reason: input.reason, details: input.details, ...fields },
    });
  }

  /** Confirms the target exists and that the reporter is allowed to know about it. */
  private async resolveTarget(userId: string, { targetType, targetId }: CreateReportInput) {
    switch (targetType) {
      case 'LISTING': {
        const listing = await this.prisma.listing.findFirst({ where: { id: targetId, deletedAt: null } });
        if (!listing) throw new NotFoundException('Listing not found');
        if (listing.sellerId === userId) throw new BadRequestException('You cannot report your own listing');
        return { listingId: listing.id, reportedUserId: listing.sellerId };
      }
      case 'USER': {
        if (targetId === userId) throw new BadRequestException('You cannot report yourself');
        const target = await this.prisma.user.findUnique({ where: { id: targetId }, select: { id: true } });
        if (!target) throw new NotFoundException('User not found');
        return { reportedUserId: target.id };
      }
      case 'MESSAGE': {
        const message = await this.prisma.message.findFirst({
          where: { id: targetId, conversation: { participants: { some: { userId } } } },
        });
        if (!message) throw new NotFoundException('Message not found');
        if (message.senderId === userId) throw new BadRequestException('You cannot report your own message');
        return { messageId: message.id, conversationId: message.conversationId, reportedUserId: message.senderId };
      }
      case 'CONVERSATION': {
        const conversation = await this.prisma.conversation.findFirst({
          where: { id: targetId, participants: { some: { userId } } },
        });
        if (!conversation) throw new NotFoundException('Conversation not found');
        const other = conversation.buyerId === userId ? conversation.sellerId : conversation.buyerId;
        return { conversationId: conversation.id, reportedUserId: other };
      }
    }
  }

  /** Only the buyer the seller named at mark-sold can review, once per listing. */
  async review(user: User, listingId: string, rating: number, comment?: string) {
    const listing = await this.prisma.listing.findFirst({ where: { id: listingId, deletedAt: null } });
    if (!listing) throw new NotFoundException('Listing not found');
    if (listing.status !== 'SOLD' || listing.soldToUserId !== user.id) {
      throw new ForbiddenException('Only the buyer the seller confirmed can review this sale');
    }
    try {
      const notification = await this.prisma.$transaction(async (tx) => {
        await tx.review.create({ data: { listingId, reviewerId: user.id, revieweeId: listing.sellerId, rating, comment } });
        return this.notifications.create(tx, {
          userId: listing.sellerId,
          type: 'REVIEW_RECEIVED',
          title: `${user.displayName} left you a ${rating}-star review`,
          body: listing.title ?? undefined,
          href: '/account',
        });
      });
      this.notifications.push(notification);
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new ConflictException('You have already reviewed this sale');
      }
      throw e;
    }
  }

  async pendingReviews(userId: string) {
    const rows = await this.prisma.listing.findMany({
      where: { soldToUserId: userId, status: 'SOLD', deletedAt: null, reviews: { none: { reviewerId: userId } } },
      orderBy: { soldAt: 'desc' },
      take: 20,
      select: { id: true, title: true, seller: { select: { displayName: true } } },
    });
    return rows.map((l) => ({
      listingId: l.id,
      path: listingPath({ id: l.id, title: l.title }),
      title: l.title ?? 'Untitled',
      sellerName: l.seller.displayName,
    }));
  }
}

@ApiTags('trust')
@Controller()
export class TrustController {
  constructor(private readonly trust: TrustService) {}

  @RateLimit({ name: 'report', limit: 20, windowSeconds: 3600, by: 'user' })
  @Post('reports')
  async report(@CurrentUser() user: AuthUser, @Body() dto: CreateReportDto) {
    await this.trust.report(user, dto);
    return { ok: true };
  }

  @VerifiedOnly()
  @RateLimit({ name: 'review', limit: 20, windowSeconds: 3600, by: 'user' })
  @Post('reviews')
  async review(@CurrentUser() user: AuthUser, @Body() dto: CreateReviewDto) {
    await this.trust.review(user, dto.listingId, dto.rating, dto.comment);
    return { ok: true };
  }

  @Get('me/pending-reviews')
  pending(@CurrentUser() user: AuthUser) {
    return this.trust.pendingReviews(user.id);
  }
}
