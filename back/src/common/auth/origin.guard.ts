import { type CanActivate, type ExecutionContext, Injectable } from '@nestjs/common';
import type { Request } from 'express';
import { AppConfig } from '../../config/app-config.service';
import { AppException } from '../errors/app.exception';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * CSRF defence in depth (on top of SameSite=Lax cookies and JSON-only bodies):
 * state-changing requests coming from a browser must originate from an allowed origin.
 * Requests without Origin/Referer (server-to-server, curl) carry no victim cookies.
 */
@Injectable()
export class OriginGuard implements CanActivate {
  private readonly allowed: Set<string>;

  constructor(config: AppConfig) {
    this.allowed = new Set(config.get('WEB_ORIGIN'));
  }

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<Request>();
    if (SAFE_METHODS.has(req.method)) return true;

    const origin = req.headers.origin ?? this.originFromReferer(req.headers.referer);
    if (!origin) return true;
    if (this.allowed.has(origin)) return true;

    throw AppException.forbidden('CSRF_REJECTED', 'Origin not allowed');
  }

  private originFromReferer(referer: string | undefined): string | undefined {
    if (!referer) return undefined;
    try {
      return new URL(referer).origin;
    } catch {
      return 'invalid';
    }
  }
}
