import { Injectable } from '@nestjs/common';
import { SESSION_COOKIE } from '@sellnest/shared';
import type { CookieOptions, Response } from 'express';
import { createHash, randomBytes } from 'node:crypto';
import { PrismaService } from '../../common/prisma.service';
import { env } from '../../config/env';

const SESSION_DAYS = 30;
const TOUCH_INTERVAL_MS = 60 * 60 * 1000;

export const hashToken = (token: string) => createHash('sha256').update(token).digest('hex');
export const newToken = () => randomBytes(32).toString('base64url');

@Injectable()
export class SessionService {
  constructor(private readonly prisma: PrismaService) {}

  private cookieOptions(): CookieOptions {
    return {
      httpOnly: true,
      secure: env().NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: SESSION_DAYS * 86_400_000,
    };
  }

  async create(userId: string, userAgent: string | undefined, res: Response) {
    const token = newToken();
    await this.prisma.session.create({
      data: {
        userId,
        tokenHash: hashToken(token),
        userAgent: userAgent?.slice(0, 200),
        expiresAt: new Date(Date.now() + SESSION_DAYS * 86_400_000),
      },
    });
    res.cookie(SESSION_COOKIE, token, this.cookieOptions());
  }

  async resolve(token: string) {
    const session = await this.prisma.session.findUnique({
      where: { tokenHash: hashToken(token) },
      include: { user: true },
    });
    if (!session || session.expiresAt < new Date()) return null;
    if (Date.now() - session.lastSeenAt.getTime() > TOUCH_INTERVAL_MS) {
      // Sliding expiry, written at most hourly so reads do not become writes.
      await this.prisma.session.update({
        where: { id: session.id },
        data: { lastSeenAt: new Date(), expiresAt: new Date(Date.now() + SESSION_DAYS * 86_400_000) },
      });
    }
    return session;
  }

  async revoke(sessionId: string, res: Response) {
    await this.prisma.session.deleteMany({ where: { id: sessionId } });
    const { maxAge: _maxAge, ...options } = this.cookieOptions();
    res.clearCookie(SESSION_COOKIE, options);
  }

  revokeAll(userId: string, exceptSessionId?: string) {
    return this.prisma.session.deleteMany({
      where: { userId, ...(exceptSessionId ? { id: { not: exceptSessionId } } : {}) },
    });
  }
}
