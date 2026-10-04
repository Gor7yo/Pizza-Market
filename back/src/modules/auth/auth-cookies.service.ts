import { Injectable } from '@nestjs/common';
import type { CookieOptions, Response } from 'express';
import { AppConfig } from '../../config/app-config.service';
import {
  ACCESS_COOKIE,
  OAUTH_STATE_COOKIE,
  OAUTH_STATE_TTL_SECONDS,
  REFRESH_COOKIE,
} from './auth.constants';

/**
 * Tokens live only in HttpOnly cookies - never in JS-accessible storage.
 * SameSite=Lax blocks cross-site POSTs while keeping top-level OAuth redirects working.
 */
@Injectable()
export class AuthCookiesService {
  constructor(private readonly config: AppConfig) {}

  private base(maxAgeMs: number): CookieOptions {
    return {
      httpOnly: true,
      secure: this.config.cookieSecure,
      sameSite: 'lax',
      path: '/',
      domain: this.config.get('COOKIE_DOMAIN'),
      maxAge: maxAgeMs,
    };
  }

  setAccess(res: Response, accessToken: string): void {
    res.cookie(
      ACCESS_COOKIE,
      accessToken,
      this.base(this.config.get('JWT_ACCESS_TTL_SECONDS') * 1000),
    );
  }

  setSession(res: Response, accessToken: string, refreshToken: string | null): void {
    this.setAccess(res, accessToken);
    if (refreshToken) {
      res.cookie(
        REFRESH_COOKIE,
        refreshToken,
        this.base(this.config.get('REFRESH_TOKEN_TTL_DAYS') * 24 * 3600 * 1000),
      );
    }
  }

  clear(res: Response): void {
    const { maxAge: _ignored, ...options } = this.base(0);
    res.clearCookie(ACCESS_COOKIE, options);
    res.clearCookie(REFRESH_COOKIE, options);
  }

  setOAuthState(res: Response, state: string): void {
    res.cookie(OAUTH_STATE_COOKIE, state, this.base(OAUTH_STATE_TTL_SECONDS * 1000));
  }

  clearOAuthState(res: Response): void {
    const { maxAge: _ignored, ...options } = this.base(0);
    res.clearCookie(OAUTH_STATE_COOKIE, options);
  }
}
