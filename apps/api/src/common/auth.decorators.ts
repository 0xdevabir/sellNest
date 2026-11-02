import { createParamDecorator, ExecutionContext, SetMetadata } from '@nestjs/common';
import type { User, UserRole } from '@prisma/client';
import type { Request } from 'express';

export const IS_PUBLIC = 'isPublic';
export const ROLES = 'roles';
export const VERIFIED_ONLY = 'verifiedOnly';
export const RATE_LIMIT = 'rateLimit';

/** Routes require a session unless marked. Security should not depend on remembering a decorator. */
export const Public = () => SetMetadata(IS_PUBLIC, true);
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES, roles);
/** The account must have a verified email and be in good standing. */
export const VerifiedOnly = () => SetMetadata(VERIFIED_ONLY, true);

export interface RateLimitOptions {
  name: string;
  limit: number;
  windowSeconds: number;
  /** ip is for anonymous routes; user falls back to ip when signed out. */
  by?: 'ip' | 'user';
}
export const RateLimit = (options: RateLimitOptions) => SetMetadata(RATE_LIMIT, options);

export type AuthUser = User;
export type AuthedRequest = Request & { user?: AuthUser; sessionId?: string };

export const CurrentUser = createParamDecorator((_: unknown, ctx: ExecutionContext) => {
  return ctx.switchToHttp().getRequest<AuthedRequest>().user;
});
