import { type CanActivate, type ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { UserRole } from '@market/shared';
import type { Request } from 'express';
import { IS_PUBLIC_KEY, ROLES_KEY } from '../../common/auth/decorators';
import { AppException } from '../../common/errors/app.exception';
import { ACCESS_COOKIE } from './auth.constants';
import { SessionsService } from './sessions.service';
import { TokenService } from './token.service';

function extractToken(req: Request): string | undefined {
  const cookie = (req.cookies as Record<string, string | undefined> | undefined)?.[ACCESS_COOKIE];
  if (cookie) return cookie;
  const header = req.headers.authorization;
  if (header?.startsWith('Bearer ')) return header.slice(7);
  return undefined;
}

/**
 * Global authentication + role authorization (secure by default):
 * every route requires a valid session unless marked @Public();
 * @Roles()/@AdminOnly() are checked here, server-side, for every request.
 */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly tokens: TokenService,
    private readonly sessions: SessionsService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (context.getType() !== 'http') return true;
    const req = context.switchToHttp().getRequest<Request>();

    const token = extractToken(req);
    if (token) {
      const user = await this.tokens.verifyAccess(token);
      if (user && !(await this.sessions.isRevoked(user.sessionId))) req.user = user;
    }

    const targets = [context.getHandler(), context.getClass()];
    if (this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, targets)) return true;

    if (!req.user) throw AppException.unauthorized();

    const roles = this.reflector.getAllAndOverride<UserRole[] | undefined>(ROLES_KEY, targets);
    if (roles && roles.length > 0 && !roles.includes(req.user.role)) {
      throw AppException.forbidden();
    }
    return true;
  }
}
