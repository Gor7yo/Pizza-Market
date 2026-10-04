import {
  applyDecorators,
  createParamDecorator,
  type ExecutionContext,
  SetMetadata,
} from '@nestjs/common';
import { ApiCookieAuth, ApiForbiddenResponse, ApiUnauthorizedResponse } from '@nestjs/swagger';
import type { UserRole } from '@market/shared';
import type { Request } from 'express';
import { AppException } from '../errors/app.exception';
import { getClientIp } from '../http/client-ip';
import type { AuthUser } from './auth-user';

export const IS_PUBLIC_KEY = 'auth:isPublic';
export const ROLES_KEY = 'auth:roles';

/** Route does not require authentication (the user is still attached if a valid token exists). */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

/**
 * Restricts a controller/route to the given roles.
 * Enforced centrally by the global AuthGuard - never by the client.
 */
export const Roles = (...roles: UserRole[]) =>
  applyDecorators(
    SetMetadata(ROLES_KEY, roles),
    ApiCookieAuth('access_token'),
    ApiUnauthorizedResponse({ description: 'Not authenticated' }),
    ApiForbiddenResponse({ description: 'Insufficient role' }),
  );

export const AdminOnly = () => Roles('ADMIN');

/** Marks an authenticated (any role) route in Swagger. Authentication itself is global. */
export const Authenticated = () =>
  applyDecorators(
    ApiCookieAuth('access_token'),
    ApiUnauthorizedResponse({ description: 'Not authenticated' }),
  );

/** The authenticated user. Throws 401 if used on a public route without a session. */
export const CurrentUser = createParamDecorator((_: unknown, ctx: ExecutionContext): AuthUser => {
  const user = ctx.switchToHttp().getRequest<Request>().user;
  if (!user) throw AppException.unauthorized();
  return user;
});

/** The authenticated user or null (for public routes with optional auth). */
export const OptionalUser = createParamDecorator(
  (_: unknown, ctx: ExecutionContext): AuthUser | null =>
    ctx.switchToHttp().getRequest<Request>().user ?? null,
);

export interface ClientInfo {
  ip: string | null;
  userAgent: string | null;
}

export const Client = createParamDecorator((_: unknown, ctx: ExecutionContext): ClientInfo => {
  const req = ctx.switchToHttp().getRequest<Request>();
  const ua = req.headers['user-agent'];
  return { ip: getClientIp(req), userAgent: typeof ua === 'string' ? ua.slice(0, 300) : null };
});
