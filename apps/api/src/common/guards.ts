import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { SESSION_COOKIE } from '@sellnest/shared';
import { allowedOrigins } from '../config/env';
import { SessionService } from '../modules/auth/session.service';
import {
  AuthedRequest,
  IS_PUBLIC,
  RATE_LIMIT,
  RateLimitOptions,
  ROLES,
  VERIFIED_ONLY,
} from './auth.decorators';
import { RedisService } from './redis.service';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * CSRF defence for cookie sessions, on top of SameSite=Lax: a state-changing request carrying
 * a session cookie must come from an allowed Origin. Browsers always send Origin on these
 * requests and page scripts cannot forge it.
 */
@Injectable()
export class OriginGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<AuthedRequest>();
    if (SAFE_METHODS.has(req.method) || !req.cookies?.[SESSION_COOKIE]) return true;
    const origin = req.headers.origin;
    if (origin && allowedOrigins().includes(origin)) return true;
    throw new ForbiddenException('Request origin is not allowed');
  }
}

/** Resolves the session on every route and enforces authentication unless the route is @Public. */
@Injectable()
export class SessionGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly sessions: SessionService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<AuthedRequest>();
    const token = req.cookies?.[SESSION_COOKIE] as string | undefined;
    if (token) {
      const session = await this.sessions.resolve(token);
      if (session) {
        req.user = session.user;
        req.sessionId = session.id;
      }
    }
    const targets = [context.getHandler(), context.getClass()];
    if (this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, targets)) return true;
    if (!req.user) throw new UnauthorizedException('Sign in to continue');
    if (req.user.status !== 'ACTIVE') {
      throw new ForbiddenException(`Your account is ${req.user.status.toLowerCase()}. Contact support.`);
    }
    if (this.reflector.getAllAndOverride<boolean>(VERIFIED_ONLY, targets) && !req.user.emailVerifiedAt) {
      throw new ForbiddenException({ code: 'EMAIL_NOT_VERIFIED', message: 'Verify your email address first' });
    }
    return true;
  }
}

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const roles = this.reflector.getAllAndOverride<string[]>(ROLES, [context.getHandler(), context.getClass()]);
    if (!roles?.length) return true;
    const { user } = context.switchToHttp().getRequest<AuthedRequest>();
    if (user && roles.includes(user.role)) return true;
    throw new ForbiddenException('You do not have permission to do this');
  }
}

/** Redis-backed so limits hold across restarts and replicas. Fails open if Redis is down. */
@Injectable()
export class RateLimitGuard implements CanActivate {
  private readonly logger = new Logger(RateLimitGuard.name);
  private static readonly DEFAULT: RateLimitOptions = { name: 'global', limit: 300, windowSeconds: 60, by: 'ip' };

  constructor(
    private readonly reflector: Reflector,
    private readonly redis: RedisService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const options =
      this.reflector.getAllAndOverride<RateLimitOptions>(RATE_LIMIT, [context.getHandler(), context.getClass()]) ??
      RateLimitGuard.DEFAULT;
    const req = context.switchToHttp().getRequest<AuthedRequest>();
    const subject = options.by === 'user' && req.user ? `u:${req.user.id}` : `ip:${req.ip}`;
    let result: { allowed: boolean; retryAfter: number };
    try {
      result = await this.redis.hit(`${options.name}:${subject}`, options.limit, options.windowSeconds);
    } catch (e) {
      this.logger.warn(`Rate limiting skipped: ${(e as Error).message}`);
      return true;
    }
    if (result.allowed) return true;
    context.switchToHttp().getResponse().setHeader('Retry-After', String(result.retryAfter));
    throw new HttpException(
      { code: 'RATE_LIMITED', message: 'Too many requests. Wait a moment and try again.' },
      HttpStatus.TOO_MANY_REQUESTS,
    );
  }
}
