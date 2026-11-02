import { Injectable } from '@nestjs/common';
import { Notification, NotificationType, Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma.service';
import { RealtimeService } from '../realtime/realtime.service';

export interface NotificationInput {
  userId: string;
  type: NotificationType;
  title: string;
  body?: string;
  href?: string;
}

@Injectable()
export class NotificationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly realtime: RealtimeService,
  ) {}

  /** Create inside the caller's transaction, then push() after commit. */
  create(tx: Prisma.TransactionClient, input: NotificationInput) {
    return tx.notification.create({ data: input });
  }

  push(notification: Notification) {
    this.realtime.toUser(notification.userId, 'notification:new', notification);
  }

  async list(userId: string, page: number, limit: number) {
    const where = { userId };
    const [items, total] = await Promise.all([
      this.prisma.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.notification.count({ where }),
    ]);
    return { items, total };
  }

  markRead(userId: string, id: string) {
    return this.prisma.notification.updateMany({ where: { id, userId, readAt: null }, data: { readAt: new Date() } });
  }

  markAllRead(userId: string) {
    return this.prisma.notification.updateMany({ where: { userId, readAt: null }, data: { readAt: new Date() } });
  }
}
