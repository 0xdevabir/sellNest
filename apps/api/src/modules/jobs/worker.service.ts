import { Injectable, Logger, OnApplicationShutdown } from '@nestjs/common';
import { Queue, Worker } from 'bullmq';
import { IMAGE_VARIANT_WIDTHS } from '@sellnest/shared';
import { PrismaService } from '../../common/prisma.service';
import { StorageService } from '../../common/storage.service';
import { bullConnection, MAIL_QUEUE, MailJob, MailService } from './mail.service';

const MAINTENANCE_QUEUE = 'maintenance';
const ORPHAN_AGE_MS = 24 * 3_600_000;

/** Started by worker.ts in production and by the API process in single-process development. */
@Injectable()
export class WorkerService implements OnApplicationShutdown {
  private readonly logger = new Logger(WorkerService.name);
  private workers: Worker[] = [];
  private maintenance?: Queue;

  constructor(
    private readonly mail: MailService,
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {}

  async start() {
    const connection = bullConnection();
    this.workers.push(
      new Worker<MailJob>(MAIL_QUEUE, (job) => this.mail.deliver(job.data), { connection, concurrency: 3 }),
      new Worker(MAINTENANCE_QUEUE, () => this.runMaintenance(), { connection }),
    );
    for (const w of this.workers) {
      w.on('failed', (job, e) => this.logger.warn(`Job ${job?.queueName}/${job?.name} failed: ${e.message}`));
    }
    this.maintenance = new Queue(MAINTENANCE_QUEUE, { connection });
    await this.maintenance.upsertJobScheduler(
      'hourly',
      { every: 3_600_000 },
      { name: 'cleanup', opts: { removeOnComplete: true, removeOnFail: 10 } },
    );
  }

  /** Deletes storage first: a crash then leaves a retryable row, never an untracked object. */
  async runMaintenance() {
    const cutoff = new Date(Date.now() - ORPHAN_AGE_MS);
    const orphans = await this.prisma.listingImage.findMany({
      where: { listingId: null, createdAt: { lt: cutoff } },
      take: 500,
    });
    const avatars = await this.prisma.user.findMany({
      where: { avatarKey: { in: orphans.map((o) => o.keyBase) } },
      select: { avatarKey: true },
    });
    const inUse = new Set(avatars.map((a) => a.avatarKey));
    const removable = orphans.filter((o) => !inUse.has(o.keyBase));
    await this.storage.deleteMany(removable.flatMap((o) => IMAGE_VARIANT_WIDTHS.map((w) => `${o.keyBase}/${w}.webp`)));
    await this.prisma.listingImage.deleteMany({ where: { id: { in: removable.map((o) => o.id) } } });

    const now = new Date();
    await this.prisma.session.deleteMany({ where: { expiresAt: { lt: now } } });
    await this.prisma.authToken.deleteMany({ where: { expiresAt: { lt: new Date(now.getTime() - 7 * 86_400_000) } } });
    return { imagesRemoved: removable.length };
  }

  async onApplicationShutdown() {
    await Promise.all(this.workers.map((w) => w.close()));
    await this.maintenance?.close();
  }
}
