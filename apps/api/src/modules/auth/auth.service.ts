import { BadRequestException, HttpException, HttpStatus, Injectable, UnauthorizedException } from '@nestjs/common';
import { AuthTokenType, Prisma, User } from '@prisma/client';
import { slugify } from '@sellnest/shared';
import * as argon2 from 'argon2';
import { randomBytes } from 'node:crypto';
import { PrismaService } from '../../common/prisma.service';
import { RedisService } from '../../common/redis.service';
import { env } from '../../config/env';
import { MailService } from '../jobs/mail.service';
import { NotificationsService } from '../notifications/notifications.service';
import { RealtimeService } from '../realtime/realtime.service';
import { hashToken, newToken, SessionService } from './session.service';

const TOKEN_HOURS: Record<AuthTokenType, number> = { EMAIL_VERIFY: 48, PASSWORD_RESET: 1 };
const MAX_FAILED_LOGINS = 10;
const LOGIN_LOCK_SECONDS = 15 * 60;

@Injectable()
export class AuthService {
  // Verified against when the email is unknown, so timing does not reveal who has an account.
  private readonly decoyHash = argon2.hash(randomBytes(32));

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly sessions: SessionService,
    private readonly mail: MailService,
    private readonly notifications: NotificationsService,
    private readonly realtime: RealtimeService,
  ) {}

  /** Always answers the same way, so this endpoint cannot be used to discover accounts. */
  async register(input: { email: string; password: string; displayName: string }) {
    const passwordHash = await argon2.hash(input.password, { type: argon2.argon2id });
    const existing = await this.prisma.user.findUnique({ where: { email: input.email } });
    if (existing) {
      await this.mail.enqueue({
        to: input.email,
        subject: 'Someone tried to sign up with your email',
        text: `This email already has a SellNest account. If this was you, sign in or reset your password: ${env().WEB_URL}/forgot-password\n\nIf it wasn't you, no action is needed.`,
      });
      return;
    }
    const user = await this.createUserWithUniqueUsername({ ...input, passwordHash });
    if (user) await this.sendVerification(user);
  }

  private async createUserWithUniqueUsername(input: { email: string; passwordHash: string; displayName: string }) {
    const base = slugify(input.email.split('@')[0] ?? 'member').replace(/[^a-z0-9]/g, '_').slice(0, 20) || 'member';
    for (let attempt = 0; attempt < 5; attempt++) {
      const username = attempt === 0 && base.length >= 3 ? base : `${base}_${randomBytes(3).toString('hex')}`;
      try {
        return await this.prisma.user.create({ data: { ...input, username } });
      } catch (e) {
        if (!(e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002')) throw e;
        // A duplicate email from a racing request ends quietly, like the existing-account path.
        if ((e.meta?.target as string[] | undefined)?.includes('email')) return null;
      }
    }
    throw new Error('Could not allocate a username');
  }

  private async issueToken(userId: string, type: AuthTokenType) {
    const token = newToken();
    await this.prisma.$transaction([
      // A new token invalidates earlier ones of the same kind.
      this.prisma.authToken.updateMany({ where: { userId, type, usedAt: null }, data: { usedAt: new Date() } }),
      this.prisma.authToken.create({
        data: { userId, type, tokenHash: hashToken(token), expiresAt: new Date(Date.now() + TOKEN_HOURS[type] * 3_600_000) },
      }),
    ]);
    return token;
  }

  private async sendVerification(user: User) {
    const token = await this.issueToken(user.id, 'EMAIL_VERIFY');
    await this.mail.enqueue({
      to: user.email,
      subject: 'Verify your SellNest email',
      text: `Hi ${user.displayName},\n\nConfirm your email to start selling and messaging on SellNest:\n${env().WEB_URL}/verify-email?token=${token}\n\nThis link expires in 48 hours.`,
    });
  }

  async resendVerification(user: User) {
    if (!user.emailVerifiedAt) await this.sendVerification(user);
  }

  /** Atomic claim: updateMany on usedAt means a token works once even under concurrent use. */
  private async consumeToken(token: string, type: AuthTokenType) {
    const tokenHash = hashToken(token);
    const claimed = await this.prisma.authToken.updateMany({
      where: { tokenHash, type, usedAt: null, expiresAt: { gt: new Date() } },
      data: { usedAt: new Date() },
    });
    if (claimed.count !== 1) throw new BadRequestException('This link is invalid or has expired. Request a new one.');
    const row = await this.prisma.authToken.findUniqueOrThrow({ where: { tokenHash } });
    return row.userId;
  }

  async verifyEmail(token: string) {
    const userId = await this.consumeToken(token, 'EMAIL_VERIFY');
    await this.prisma.user.update({ where: { id: userId }, data: { emailVerifiedAt: new Date() } });
  }

  async login(email: string, password: string) {
    const lockKey = `login-fail:${email}`;
    const failures = Number((await this.redis.client.get(lockKey).catch(() => 0)) ?? 0);
    if (failures >= MAX_FAILED_LOGINS) {
      throw new HttpException(
        { code: 'RATE_LIMITED', message: 'Too many failed attempts. Wait 15 minutes or reset your password.' },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    const user = await this.prisma.user.findUnique({ where: { email } });
    const valid = await argon2.verify(user?.passwordHash ?? (await this.decoyHash), password);
    if (!user || !valid) {
      await this.redis.hit(`login-fail-window:${email}`, MAX_FAILED_LOGINS, LOGIN_LOCK_SECONDS).catch(() => undefined);
      await this.redis.client
        .multi()
        .incr(lockKey)
        .expire(lockKey, LOGIN_LOCK_SECONDS)
        .exec()
        .catch(() => undefined);
      throw new UnauthorizedException('Email or password is incorrect');
    }
    await this.redis.invalidate(lockKey);
    if (user.status === 'BANNED') {
      throw new UnauthorizedException('This account has been banned. Contact support.');
    }
    return user;
  }

  /** Same response whether or not the account exists. */
  async forgotPassword(email: string) {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) return;
    const token = await this.issueToken(user.id, 'PASSWORD_RESET');
    await this.mail.enqueue({
      to: user.email,
      subject: 'Reset your SellNest password',
      text: `Use this link to choose a new password:\n${env().WEB_URL}/reset-password?token=${token}\n\nIt expires in 1 hour. If you didn't ask for this, ignore this email.`,
    });
  }

  async resetPassword(token: string, password: string) {
    const userId = await this.consumeToken(token, 'PASSWORD_RESET');
    const passwordHash = await argon2.hash(password, { type: argon2.argon2id });
    // Possession of the emailed link also proves control of the address.
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash, emailVerifiedAt: new Date() },
    });
    await this.sessions.revokeAll(userId);
    this.realtime.disconnectUser(userId);
    await this.redis.invalidate(`login-fail:${user.email}`);
    await this.securityNotice(userId, 'Your password was reset');
  }

  async changePassword(user: User, sessionId: string, current: string, next: string) {
    if (!(await argon2.verify(user.passwordHash, current))) {
      throw new BadRequestException('Your current password is incorrect');
    }
    const passwordHash = await argon2.hash(next, { type: argon2.argon2id });
    await this.prisma.user.update({ where: { id: user.id }, data: { passwordHash } });
    await this.sessions.revokeAll(user.id, sessionId);
    await this.securityNotice(user.id, 'Your password was changed');
  }

  private async securityNotice(userId: string, title: string) {
    const note = await this.notifications.create(this.prisma, {
      userId,
      type: 'ACCOUNT_SECURITY',
      title,
      body: "If this wasn't you, reset your password now.",
      href: '/forgot-password',
    });
    this.notifications.push(note);
  }
}
