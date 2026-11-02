import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, User } from '@prisma/client';
import { Me, PublicProfile, ReviewItem, UpdateProfileInput } from '@sellnest/shared';
import { paginated } from '../../common/dtos';
import { PrismaService } from '../../common/prisma.service';
import { ListingMapper } from '../listings/listing.mapper';

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mapper: ListingMapper,
  ) {}

  /** The only shape that includes private account fields, and it is only returned to its owner. */
  async me(user: User): Promise<Me> {
    const [location, unread, unreadNotifications] = await Promise.all([
      user.locationId
        ? this.prisma.location.findUnique({
            where: { id: user.locationId },
            select: { id: true, slug: true, name: true, type: true },
          })
        : null,
      this.prisma.conversationParticipant.aggregate({ where: { userId: user.id }, _sum: { unreadCount: true } }),
      this.prisma.notification.count({ where: { userId: user.id, readAt: null } }),
    ]);
    return {
      ...this.mapper.user(user),
      email: user.email,
      role: user.role,
      status: user.status,
      bio: user.bio,
      location,
      showSoldListings: user.showSoldListings,
      defaultRadiusKm: user.defaultRadiusKm,
      profileCompleted: user.profileCompleted,
      createdAt: user.createdAt.toISOString(),
      unreadMessages: unread._sum.unreadCount ?? 0,
      unreadNotifications,
    };
  }

  async updateProfile(user: User, dto: UpdateProfileInput) {
    const { avatarImageId, ...fields } = dto;
    const data: Prisma.UserUncheckedUpdateInput = { ...fields };
    if (avatarImageId !== undefined) {
      if (avatarImageId === null) {
        data.avatarKey = null;
      } else {
        const image = await this.prisma.listingImage.findFirst({
          where: { id: avatarImageId, uploaderId: user.id, listingId: null },
        });
        if (!image) throw new BadRequestException('That photo cannot be used');
        data.avatarKey = image.keyBase;
      }
    }
    if (fields.locationId) {
      const location = await this.prisma.location.findFirst({ where: { id: fields.locationId, isActive: true } });
      if (!location) throw new BadRequestException('Choose a valid location');
      data.profileCompleted = true;
    }
    try {
      const updated = await this.prisma.user.update({ where: { id: user.id }, data });
      return this.me(updated);
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new ConflictException('That username is taken');
      }
      throw e;
    }
  }

  async publicProfile(username: string, viewer?: User): Promise<PublicProfile> {
    const user = await this.prisma.user.findFirst({
      where: { username: username.toLowerCase(), status: 'ACTIVE' },
      include: { location: { select: { id: true, slug: true, name: true, type: true } } },
    });
    if (!user) throw new NotFoundException('Profile not found');
    const [active, sold, reviews, block] = await Promise.all([
      this.prisma.listing.count({ where: { sellerId: user.id, status: 'ACTIVE', deletedAt: null } }),
      user.showSoldListings
        ? this.prisma.listing.count({ where: { sellerId: user.id, status: 'SOLD', deletedAt: null } })
        : null,
      this.prisma.review.aggregate({ where: { revieweeId: user.id }, _count: true, _avg: { rating: true } }),
      viewer
        ? this.prisma.block.findUnique({ where: { blockerId_blockedId: { blockerId: viewer.id, blockedId: user.id } } })
        : null,
    ]);
    return {
      ...this.mapper.user(user),
      bio: user.bio,
      location: user.location,
      memberSince: user.createdAt.toISOString(),
      activeListingCount: active,
      soldListingCount: sold,
      reviewCount: reviews._count,
      averageRating: reviews._avg.rating,
      viewerHasBlocked: Boolean(block),
    };
  }

  async reviews(username: string, page: number, limit: number) {
    const user = await this.prisma.user.findFirst({ where: { username: username.toLowerCase() }, select: { id: true } });
    if (!user) throw new NotFoundException('Profile not found');
    const where = { revieweeId: user.id };
    const [rows, total] = await Promise.all([
      this.prisma.review.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: { reviewer: true, listing: { select: { title: true } } },
      }),
      this.prisma.review.count({ where }),
    ]);
    const items: ReviewItem[] = rows.map((r) => ({
      id: r.id,
      rating: r.rating,
      comment: r.comment,
      createdAt: r.createdAt.toISOString(),
      reviewer: this.mapper.user(r.reviewer),
      listingTitle: r.listing.title ?? 'A listing',
    }));
    return paginated(items, total, page, limit);
  }

  async block(blockerId: string, blockedId: string) {
    if (blockerId === blockedId) throw new BadRequestException('You cannot block yourself');
    const target = await this.prisma.user.findUnique({ where: { id: blockedId }, select: { id: true } });
    if (!target) throw new NotFoundException('User not found');
    await this.prisma.block.upsert({
      where: { blockerId_blockedId: { blockerId, blockedId } },
      create: { blockerId, blockedId },
      update: {},
    });
  }

  async unblock(blockerId: string, blockedId: string) {
    await this.prisma.block.deleteMany({ where: { blockerId, blockedId } });
  }

  async blocked(userId: string) {
    const rows = await this.prisma.block.findMany({
      where: { blockerId: userId },
      include: { blocked: true },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map((r) => this.mapper.user(r.blocked));
  }
}
