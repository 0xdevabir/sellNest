import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { Queue } from 'bullmq';
import { createTransport, Transporter } from 'nodemailer';
import { env } from '../../config/env';

export interface MailJob {
  to: string;
  subject: string;
  text: string;
}

export const MAIL_QUEUE = 'mail';
export const bullConnection = () => {
  const url = new URL(env().REDIS_URL);
  return {
    host: url.hostname,
    port: Number(url.port || 6379),
    username: url.username || undefined,
    password: url.password || undefined,
    maxRetriesPerRequest: null,
  };
};

@Injectable()
export class MailService implements OnModuleDestroy {
  private readonly logger = new Logger(MailService.name);
  private readonly queue = new Queue<MailJob>(MAIL_QUEUE, { connection: bullConnection() });
  private readonly transport?: Transporter;

  constructor() {
    const e = env();
    if (e.SMTP_HOST) {
      this.transport = createTransport({
        host: e.SMTP_HOST,
        port: e.SMTP_PORT,
        secure: e.SMTP_SECURE,
        auth: e.SMTP_USER ? { user: e.SMTP_USER, pass: e.SMTP_PASSWORD } : undefined,
      });
    } else {
      this.logger.warn('SMTP is not configured. Emails will be dropped.');
    }
  }

  /** Mail goes through the queue so slow SMTP cannot delay a request or reveal who has an account. */
  async enqueue(job: MailJob) {
    await this.queue.add('send', job, {
      attempts: 5,
      backoff: { type: 'exponential', delay: 5000 },
      // Bodies contain tokens, so they must not linger in Redis.
      removeOnComplete: true,
      removeOnFail: { age: 3600 },
    });
  }

  async deliver(job: MailJob) {
    if (!this.transport) return;
    await this.transport.sendMail({ from: env().MAIL_FROM, ...job });
  }

  async onModuleDestroy() {
    await this.queue.close();
  }
}
