import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { ListingStatus, Prisma, ReportStatus, User, UserRole, UserStatus } from '@prisma/client';
import { AdminListing, AdminOverview, AdminReport, AdminUser, AuditEntry, listingPath, PlatformSettings } from '@sellnest/shared';
import { z } from 'zod';
import { AuditService } from '../../common/audit.service';
import { paginated } from '../../common/dtos';
import { PrismaService } from '../../common/prisma.service';
import { SettingsService } from '../../common/settings.service';
import { categoryUpsertSchema, locationUpsertSchema } from '@sellnest/shared';
import { SessionService } from '../auth/session.service';
import { CatalogService } from '../catalog/catalog';
import { ListingMapper } from '../listings/listing.mapper';
import { NotificationsService } from '../notifications/notifications.service';
import { RealtimeService } from '../realtime/realtime.service';

const isUniqueViolation = (e: unknown) => e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002';

@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly settings: SettingsService,
    private readonly sessions: SessionService,
    private readonly catalog: CatalogService,
    private readonly mapper: ListingMapper,
    private readonly notifications: NotificationsService,
    private readonly realtime: RealtimeService,
  ) {}

  async overview(): Promise<AdminOverview> {
    const since = new Date(Date.now() - 7 * 86_400_000);
    const live = { deletedAt: null };
    const [
      totalUsers,
      newUsers7d,
      activeUsers7d,
      totalListings,
      activeListings,
      soldListings,
      pendingListings,
      newListings7d,
      openReports,
      reports7d,
      messages7d,
      offers7d,
    ] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.user.count({ where: { createdAt: { gte: since } } }),
      this.prisma.user.count({ where: { sessions: { some: { lastSeenAt: { gte: since } } } } }),
      this.prisma.listing.count({ where: { ...live, status: { not: 'DRAFT' } } }),
      this.prisma.listing.count({ where: { ...live, status: 'ACTIVE' } }),
      this.prisma.listing.count({ where: { ...live, status: 'SOLD' } }),
      this.prisma.listing.count({ where: { ...live, status: 'PENDING_REVIEW' } }),
      this.prisma.listing.count({ where: { ...live, publishedAt: { gte: since } } }),
      this.prisma.report.count({ where: { status: 'OPEN' } }),
      this.prisma.report.count({ where: { createdAt: { gte: since } } }),
      this.prisma.message.count({ where: { createdAt: { gte: since }, type: 'TEXT' } }),
      this.prisma.offer.count({ where: { createdAt: { gte: since } } }),
    ]);
    return {
      totalUsers,
      newUsers7d,
      activeUsers7d,
      totalListings,
      activeListings,
      soldListings,
      pendingListings,
      newListings7d,
      openReports,
      reports7d,
      messages7d,
      offers7d,
    };
  }

  async users(q: { q?: string; status?: UserStatus; role?: UserRole; page: number; limit: number }) {
    const where: Prisma.UserWhereInput = {
      ...(q.status ? { status: q.status } : {}),
      ...(q.role ? { role: q.role } : {}),
      ...(q.q
        ? {
            OR: [
              { email: { contains: q.q, mode: 'insensitive' } },
              { username: { contains: q.q, mode: 'insensitive' } },
              { displayName: { contains: q.q, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    const [rows, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (q.page - 1) * q.limit,
        take: q.limit,
        include: { _count: { select: { listings: true } } },
      }),
      this.prisma.user.count({ where }),
    ]);
    const items: AdminUser[] = rows.map((u) => ({
      id: u.id,
      email: u.email,
      username: u.username,
      displayName: u.displayName,
      role: u.role,
      status: u.status,
      emailVerified: Boolean(u.emailVerifiedAt),
      createdAt: u.createdAt.toISOString(),
      listingCount: u._count.listings,
    }));
    return paginated(items, total, q.page, q.limit);
  }

  /** Nobody can change their own account here, so no one can promote or lock out themselves. */
  async updateUser(actor: User, id: string, dto: { status?: UserStatus; role?: UserRole; reason: string }) {
    if (actor.id === id) throw new ForbiddenException('You cannot change your own account here');
    if (dto.role && actor.role !== 'ADMIN') throw new ForbiddenException('Only admins can change roles');
    const target = await this.prisma.user.findUnique({ where: { id } });
    if (!target) throw new NotFoundException('User not found');
    if (actor.role !== 'ADMIN' && target.role !== 'USER') {
      throw new ForbiddenException('Only admins can change staff accounts');
    }
    const data = {
      ...(dto.status ? { status: dto.status } : {}),
      ...(dto.role ? { role: dto.role } : {}),
    };
    if (Object.keys(data).length === 0) throw new BadRequestException('Nothing to change');
    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({ where: { id }, data });
      await this.audit.record(
        {
          actorId: actor.id,
          action: 'user.update',
          entityType: 'User',
          entityId: id,
          metadata: { before: { status: target.status, role: target.role }, after: data, reason: dto.reason },
        },
        tx,
      );
    });
    if (dto.status && dto.status !== 'ACTIVE') {
      await this.sessions.revokeAll(id);
      this.realtime.disconnectUser(id);
    }
  }

  async listings(q: { status?: ListingStatus; q?: string; page: number; limit: number }) {
    const where: Prisma.ListingWhereInput = {
      deletedAt: null,
      status: q.status ?? { not: 'DRAFT' },
      ...(q.q ? { title: { contains: q.q, mode: 'insensitive' } } : {}),
    };
    const [rows, total] = await Promise.all([
      this.prisma.listing.findMany({
        where,
        // The moderation queue runs oldest first; flagged items jump ahead.
        orderBy: q.status === 'PENDING_REVIEW' ? [{ flagReason: { sort: 'desc', nulls: 'last' } }, { updatedAt: 'asc' }] : { createdAt: 'desc' },
        skip: (q.page - 1) * q.limit,
        take: q.limit,
        include: { images: { orderBy: { position: 'asc' }, take: 1 }, seller: true },
      }),
      this.prisma.listing.count({ where }),
    ]);
    const items: AdminListing[] = rows.map((l) => ({
      id: l.id,
      path: listingPath(l),
      title: l.title,
      description: l.description,
      priceBdt: l.priceBdt,
      status: l.status,
      isDemo: l.isDemo,
      flagReason: l.flagReason,
      cover: l.images[0] ? this.mapper.image(l.images[0]) : null,
      seller: {
        id: l.seller.id,
        username: l.seller.username,
        displayName: l.seller.displayName,
        createdAt: l.seller.createdAt.toISOString(),
      },
      createdAt: l.createdAt.toISOString(),
    }));
    return paginated(items, total, q.page, q.limit);
  }

  async moderate(actor: User, id: string, decision: 'approve' | 'reject', reason?: string) {
    const notification = await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT 1 FROM "Listing" WHERE "id" = ${id}::uuid FOR UPDATE`;
      const listing = await tx.listing.findFirst({ where: { id, deletedAt: null } });
      if (!listing) throw new NotFoundException('Listing not found');
      const allowed: ListingStatus[] = decision === 'approve' ? ['PENDING_REVIEW'] : ['PENDING_REVIEW', 'ACTIVE', 'PAUSED'];
      if (!allowed.includes(listing.status)) {
        throw new ConflictException(`This listing is ${listing.status.toLowerCase().replace('_', ' ')} and cannot be changed`);
      }
      await tx.listing.update({
        where: { id },
        data:
          decision === 'approve'
            ? { status: 'ACTIVE', publishedAt: new Date(), flagReason: null, rejectionReason: null }
            : { status: 'REJECTED', rejectionReason: reason, publishedAt: null },
      });
      if (decision === 'reject') {
        // A removed listing cannot honour open negotiations.
        const open = await tx.offer.findMany({
          where: { listingId: id, status: { in: ['PENDING', 'COUNTERED', 'ACCEPTED'] } },
          select: { id: true },
        });
        if (open.length) {
          await tx.offer.updateMany({ where: { id: { in: open.map((o) => o.id) } }, data: { status: 'EXPIRED' } });
          await tx.offerEvent.createMany({ data: open.map((o) => ({ offerId: o.id, actorId: actor.id, type: 'EXPIRED' })) });
        }
      }
      await this.audit.record(
        { actorId: actor.id, action: `listing.${decision}`, entityType: 'Listing', entityId: id, metadata: { reason: reason ?? null } },
        tx,
      );
      return this.notifications.create(tx, {
        userId: listing.sellerId,
        type: decision === 'approve' ? 'LISTING_APPROVED' : 'LISTING_REJECTED',
        title: decision === 'approve' ? `${listing.title} is now live` : `${listing.title} was not approved`,
        body: reason,
        href: decision === 'approve' ? listingPath(listing) : `/sell/${id}`,
      });
    });
    this.notifications.push(notification);
  }

  async reports(q: { status?: ReportStatus; page: number; limit: number }) {
    const where: Prisma.ReportWhereInput = q.status ? { status: q.status } : {};
    const [rows, total] = await Promise.all([
      this.prisma.report.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (q.page - 1) * q.limit,
        take: q.limit,
        include: {
          reporter: { select: { id: true, username: true } },
          listing: { select: { id: true, title: true } },
          reportedUser: { select: { username: true } },
          message: { select: { body: true } },
        },
      }),
      this.prisma.report.count({ where }),
    ]);
    const items: AdminReport[] = rows.map((r) => ({
      id: r.id,
      targetType: r.targetType,
      reason: r.reason,
      details: r.details,
      status: r.status,
      note: r.note,
      createdAt: r.createdAt.toISOString(),
      reporter: r.reporter,
      target: {
        label: r.listing?.title ?? (r.reportedUser ? `@${r.reportedUser.username}` : 'Removed content'),
        href: r.listing ? listingPath(r.listing) : r.reportedUser ? `/u/${r.reportedUser.username}` : null,
        // Moderators only see the reported message, not the rest of the conversation.
        excerpt: r.message?.body ?? null,
      },
    }));
    return paginated(items, total, q.page, q.limit);
  }

  async resolveReport(actor: User, id: string, status: 'RESOLVED' | 'DISMISSED', note?: string) {
    await this.prisma.$transaction(async (tx) => {
      const claimed = await tx.report.updateMany({
        where: { id, status: 'OPEN' },
        data: { status, note, resolvedById: actor.id, resolvedAt: new Date() },
      });
      if (claimed.count !== 1) throw new ConflictException('This report has already been handled');
      await this.audit.record(
        { actorId: actor.id, action: `report.${status.toLowerCase()}`, entityType: 'Report', entityId: id, metadata: { note: note ?? null } },
        tx,
      );
    });
  }

  async allCategories() {
    return this.prisma.category.findMany({ orderBy: [{ parentId: 'asc' }, { sortOrder: 'asc' }, { name: 'asc' }] });
  }

  async upsertCategory(actor: User, id: string | null, dto: z.infer<typeof categoryUpsertSchema>) {
    try {
      const row = await this.prisma.$transaction(async (tx) => {
        const saved = id ? await tx.category.update({ where: { id }, data: dto }) : await tx.category.create({ data: dto });
        await this.audit.record(
          { actorId: actor.id, action: id ? 'category.update' : 'category.create', entityType: 'Category', entityId: saved.id, metadata: dto },
          tx,
        );
        return saved;
      });
      await this.catalog.invalidateCatalog();
      return row;
    } catch (e) {
      if (isUniqueViolation(e)) throw new ConflictException('That slug is already in use');
      throw e;
    }
  }

  async allLocations() {
    return this.prisma.location.findMany({
      orderBy: [{ isFeatured: 'desc' }, { name: 'asc' }],
      omit: {},
    });
  }

  async upsertLocation(actor: User, id: string | null, dto: z.infer<typeof locationUpsertSchema>) {
    if (id && dto.parentId === id) throw new BadRequestException('A location cannot be its own parent');
    try {
      const row = await this.prisma.$transaction(async (tx) => {
        const saved = id ? await tx.location.update({ where: { id }, data: dto }) : await tx.location.create({ data: dto });
        // Listings hold a copy of their area's centre, so moving an area moves them too.
        if (id) {
          await tx.listing.updateMany({
            where: { locationId: id },
            data: { latitude: dto.latitude, longitude: dto.longitude },
          });
        }
        await this.audit.record(
          { actorId: actor.id, action: id ? 'location.update' : 'location.create', entityType: 'Location', entityId: saved.id, metadata: dto },
          tx,
        );
        return saved;
      });
      await this.catalog.invalidateCatalog();
      return row;
    } catch (e) {
      if (isUniqueViolation(e)) throw new ConflictException('That slug is already in use');
      throw e;
    }
  }

  getSettings() {
    return this.settings.get();
  }

  async updateSettings(actor: User, value: PlatformSettings) {
    if (!value.radiiKm.includes(value.defaultRadiusKm)) {
      throw new BadRequestException('The default radius must be one of the radius options');
    }
    await this.prisma.$transaction(async (tx) => {
      await this.settings.update(value, tx);
      await this.audit.record({ actorId: actor.id, action: 'settings.update', entityType: 'PlatformSetting', entityId: 'platform', metadata: value }, tx);
    });
    await this.settings.invalidate();
    return value;
  }

  async auditLog(page: number, limit: number) {
    const [rows, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: { actor: { select: { id: true, username: true } } },
      }),
      this.prisma.auditLog.count(),
    ]);
    const items: AuditEntry[] = rows.map((a) => ({
      id: a.id,
      action: a.action,
      entityType: a.entityType,
      entityId: a.entityId,
      metadata: a.metadata,
      createdAt: a.createdAt.toISOString(),
      actor: a.actor,
    }));
    return paginated(items, total, page, limit);
  }
}
