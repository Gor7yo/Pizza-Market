import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Logger,
  Post,
  Query,
  Req,
  Res,
} from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import {
  type AuthResultDto,
  emailOnlySchema,
  loginSchema,
  registerSchema,
  type RegisterResultDto,
  resetPasswordSchema,
  type UserDto,
  verifyEmailSchema,
} from '@market/shared';
import type { Request, Response } from 'express';
import type { z } from 'zod';
import type { AuthUser } from '../../common/auth/auth-user';
import {
  Authenticated,
  Client,
  type ClientInfo,
  CurrentUser,
  OptionalUser,
  Public,
} from '../../common/auth/decorators';
import { AppException } from '../../common/errors/app.exception';
import { ZodBody } from '../../common/validation/zod.decorators';
import { AppConfig } from '../../config/app-config.service';
import { AuthCookiesService } from './auth-cookies.service';
import { OAUTH_STATE_COOKIE, REFRESH_COOKIE } from './auth.constants';
import { AuthService, type IssuedSession } from './auth.service';
import { GoogleOAuthService } from './google-oauth.service';
import { PasswordResetService } from './password-reset.service';
import { SessionsService } from './sessions.service';

const MINUTE = 60_000;

function cookie(req: Request, name: string): string | undefined {
  const value = (req.cookies as Record<string, unknown> | undefined)?.[name];
  return typeof value === 'string' ? value : undefined;
}

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  private readonly logger = new Logger(AuthController.name);

  constructor(
    private readonly auth: AuthService,
    private readonly sessions: SessionsService,
    private readonly cookies: AuthCookiesService,
    private readonly passwordReset: PasswordResetService,
    private readonly google: GoogleOAuthService,
    private readonly config: AppConfig,
  ) {}

  private respond(res: Response, issued: IssuedSession): AuthResultDto {
    this.cookies.setSession(res, issued.accessToken, issued.refreshToken);
    return { user: issued.user };
  }

  @Public()
  @Throttle({ default: { limit: 5, ttl: MINUTE } })
  @Post('register')
  register(
    @ZodBody(registerSchema) body: z.output<typeof registerSchema>,
  ): Promise<RegisterResultDto> {
    return this.auth.register(body);
  }

  @Public()
  @Throttle({ default: { limit: 10, ttl: MINUTE } })
  @HttpCode(HttpStatus.OK)
  @Post('verify-email')
  async verifyEmail(
    @ZodBody(verifyEmailSchema) body: z.output<typeof verifyEmailSchema>,
    @Client() client: ClientInfo,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthResultDto> {
    return this.respond(res, await this.auth.verifyEmail(body, client));
  }

  @Public()
  @Throttle({ default: { limit: 3, ttl: MINUTE } })
  @HttpCode(HttpStatus.NO_CONTENT)
  @Post('resend-verification')
  async resendVerification(
    @ZodBody(emailOnlySchema) body: z.output<typeof emailOnlySchema>,
  ): Promise<void> {
    await this.auth.resendVerification(body.email);
  }

  @Public()
  @Throttle({ default: { limit: 10, ttl: MINUTE } })
  @HttpCode(HttpStatus.OK)
  @Post('login')
  async login(
    @ZodBody(loginSchema) body: z.output<typeof loginSchema>,
    @Client() client: ClientInfo,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthResultDto> {
    return this.respond(res, await this.auth.login(body, client));
  }

  @Public()
  @Throttle({ default: { limit: 30, ttl: MINUTE } })
  @HttpCode(HttpStatus.OK)
  @Post('refresh')
  async refresh(
    @Req() req: Request,
    @Client() client: ClientInfo,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthResultDto> {
    try {
      return this.respond(res, await this.auth.refresh(cookie(req, REFRESH_COOKIE), client));
    } catch (err) {
      this.cookies.clear(res);
      throw err;
    }
  }

  /** Works even with an expired access token: the refresh cookie identifies the session. */
  @Public()
  @HttpCode(HttpStatus.NO_CONTENT)
  @Post('logout')
  async logout(
    @Req() req: Request,
    @OptionalUser() user: AuthUser | null,
    @Res({ passthrough: true }) res: Response,
  ): Promise<void> {
    await this.auth.logout(cookie(req, REFRESH_COOKIE), user?.sessionId);
    this.cookies.clear(res);
  }

  @Authenticated()
  @HttpCode(HttpStatus.NO_CONTENT)
  @Post('logout-all')
  async logoutAll(
    @CurrentUser() user: AuthUser,
    @Res({ passthrough: true }) res: Response,
  ): Promise<void> {
    await this.sessions.revokeAllForUser(user.id);
    this.cookies.clear(res);
  }

  @Authenticated()
  @ApiOkResponse({ description: 'Current user' })
  @Get('me')
  me(@CurrentUser() user: AuthUser): Promise<UserDto> {
    return this.auth.me(user.id);
  }

  @Public()
  @Throttle({ default: { limit: 3, ttl: MINUTE } })
  @HttpCode(HttpStatus.NO_CONTENT)
  @Post('forgot-password')
  async forgotPassword(
    @ZodBody(emailOnlySchema) body: z.output<typeof emailOnlySchema>,
  ): Promise<void> {
    await this.passwordReset.request(body.email);
  }

  @Public()
  @Throttle({ default: { limit: 5, ttl: MINUTE } })
  @HttpCode(HttpStatus.NO_CONTENT)
  @Post('reset-password')
  async resetPassword(
    @ZodBody(resetPasswordSchema) body: z.output<typeof resetPasswordSchema>,
  ): Promise<void> {
    await this.passwordReset.reset(body.token, body.password);
  }

  @Public()
  @Get('providers')
  providers(): { google: boolean } {
    return { google: this.google.enabled };
  }

  @Public()
  @Throttle({ default: { limit: 20, ttl: MINUTE } })
  @Get('google')
  async googleStart(
    @Query('returnTo') returnTo: string | undefined,
    @Res() res: Response,
  ): Promise<void> {
    const { url, state } = await this.google.createAuthorizationUrl(returnTo ?? '/');
    this.cookies.setOAuthState(res, state);
    res.redirect(url);
  }

  @Public()
  @Throttle({ default: { limit: 20, ttl: MINUTE } })
  @Get('google/callback')
  async googleCallback(
    @Query('code') code: string | undefined,
    @Query('state') state: string | undefined,
    @Query('error') error: string | undefined,
    @Req() req: Request,
    @Client() client: ClientInfo,
    @Res() res: Response,
  ): Promise<void> {
    const web = this.config.get('PUBLIC_WEB_URL');
    const cookieState = cookie(req, OAUTH_STATE_COOKIE);
    this.cookies.clearOAuthState(res);
    try {
      if (error || !code || !state)
        throw AppException.badRequest('OAUTH_FAILED', error ?? 'Missing code');
      const { user, returnTo } = await this.google.handleCallback({ code, state, cookieState });
      const issued = await this.auth.startSession(user.id, client);
      this.cookies.setSession(res, issued.accessToken, issued.refreshToken);
      res.redirect(`${web}${returnTo}`);
    } catch (err) {
      const reason = err instanceof AppException ? err.code : 'OAUTH_FAILED';
      if (err instanceof AppException) {
        this.logger.warn(`Google callback failed: ${reason} (${err.message})`);
      } else {
        // unexpected (DB, network...): keep the real error in the logs
        this.logger.error({ err }, `Google callback failed with an unexpected error`);
      }
      res.redirect(`${web}/login?error=${encodeURIComponent(reason)}`);
    }
  }
}
