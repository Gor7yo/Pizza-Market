import { Injectable, Logger } from '@nestjs/common';
import { CodeChallengeMethod, OAuth2Client } from 'google-auth-library';
import { AppException } from '../../common/errors/app.exception';
import { randomToken } from '../../common/utils/crypto';
import { AppConfig } from '../../config/app-config.service';
import type { User } from '../../generated/prisma/client';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { RedisService } from '../../infrastructure/redis/redis.service';
import { OAUTH_STATE_TTL_SECONDS, redisKeys } from './auth.constants';
import { SessionsService } from './sessions.service';

interface StoredState {
  codeVerifier: string;
  returnTo: string;
}

/** Only same-site relative paths are allowed as post-login redirect targets. */
export function sanitizeReturnTo(value: unknown): string {
  if (
    typeof value !== 'string' ||
    !value.startsWith('/') ||
    value.startsWith('//') ||
    value.includes('\\')
  ) {
    return '/';
  }
  return value.slice(0, 300);
}

/**
 * Google sign-in with the authorization code flow + PKCE + state.
 * Account linking rules:
 *  - known Google account          -> sign in to the linked user
 *  - unknown, e-mail matches user  -> link (Google verified the e-mail). If the local
 *    account was never verified, its password is dropped: whoever registered it could
 *    not prove ownership of the mailbox (prevents pre-registration account takeover).
 *  - otherwise                     -> create a new verified user without a password
 */
@Injectable()
export class GoogleOAuthService {
  private readonly logger = new Logger(GoogleOAuthService.name);

  constructor(
    private readonly config: AppConfig,
    private readonly redis: RedisService,
    private readonly prisma: PrismaService,
    private readonly sessions: SessionsService,
  ) {}

  get enabled(): boolean {
    return this.config.googleOAuthEnabled;
  }

  private client(): OAuth2Client {
    if (!this.enabled) throw AppException.notFound('Google sign-in');
    return new OAuth2Client({
      clientId: this.config.get('GOOGLE_CLIENT_ID'),
      clientSecret: this.config.get('GOOGLE_CLIENT_SECRET'),
      redirectUri: this.config.get('GOOGLE_REDIRECT_URI'),
    });
  }

  async createAuthorizationUrl(returnTo: string): Promise<{ url: string; state: string }> {
    const client = this.client();
    const state = randomToken(24);
    const { codeVerifier, codeChallenge } = await client.generateCodeVerifierAsync();
    const stored: StoredState = { codeVerifier, returnTo: sanitizeReturnTo(returnTo) };
    await this.redis.setJson(redisKeys.oauthState(state), stored, OAUTH_STATE_TTL_SECONDS);

    const url = client.generateAuthUrl({
      access_type: 'online',
      scope: ['openid', 'email', 'profile'],
      state,
      prompt: 'select_account',
      code_challenge_method: CodeChallengeMethod.S256,
      code_challenge: codeChallenge,
    });
    return { url, state };
  }

  /** Validates state (bound to the browser cookie), exchanges the code and resolves the user. */
  async handleCallback(params: {
    code: string;
    state: string;
    cookieState: string | undefined;
  }): Promise<{ user: User; returnTo: string }> {
    if (!params.cookieState || params.cookieState !== params.state) {
      throw AppException.badRequest('OAUTH_FAILED', 'State mismatch');
    }
    const key = redisKeys.oauthState(params.state);
    const stored = await this.redis.getJson<StoredState>(key);
    await this.redis.client.del(key);
    if (!stored) throw AppException.badRequest('OAUTH_FAILED', 'State expired');

    const client = this.client();
    let profile: {
      sub: string;
      email: string;
      firstName: string;
      lastName: string | null;
      picture: string | null;
    };
    try {
      const { tokens } = await client.getToken({
        code: params.code,
        codeVerifier: stored.codeVerifier,
      });
      if (!tokens.id_token) throw new Error('No id_token');
      const ticket = await client.verifyIdToken({
        idToken: tokens.id_token,
        audience: this.config.get('GOOGLE_CLIENT_ID'),
      });
      const payload = ticket.getPayload();
      if (!payload?.sub || !payload.email || payload.email_verified !== true) {
        throw new Error('Google account e-mail is not verified');
      }
      profile = {
        sub: payload.sub,
        email: payload.email.toLowerCase(),
        firstName: payload.given_name ?? payload.email.split('@')[0] ?? 'Guest',
        lastName: payload.family_name ?? null,
        picture: payload.picture ?? null,
      };
    } catch (err) {
      // Google's error body (invalid_grant, redirect_uri_mismatch, invalid_client...) is the useful part
      const details = (err as { response?: { data?: unknown } }).response?.data;
      this.logger.warn(
        `Google OAuth exchange failed: ${(err as Error).message}${details ? ` ${JSON.stringify(details)}` : ''}`,
      );
      throw AppException.badRequest('OAUTH_FAILED', 'Google sign-in failed');
    }

    const user = await this.resolveUser(profile);
    if (user.isBlocked) throw AppException.forbidden('ACCOUNT_BLOCKED', 'Account is blocked');
    return { user, returnTo: stored.returnTo };
  }

  private async resolveUser(profile: {
    sub: string;
    email: string;
    firstName: string;
    lastName: string | null;
    picture: string | null;
  }): Promise<User> {
    const linked = await this.prisma.account.findUnique({
      where: { provider_providerAccountId: { provider: 'GOOGLE', providerAccountId: profile.sub } },
      include: { user: true },
    });
    if (linked) return linked.user;

    const existing = await this.prisma.user.findUnique({ where: { email: profile.email } });
    if (existing) {
      const wasUnverified = existing.emailVerifiedAt === null;
      const user = await this.prisma.user.update({
        where: { id: existing.id },
        data: {
          emailVerifiedAt: existing.emailVerifiedAt ?? new Date(),
          passwordHash: wasUnverified ? null : existing.passwordHash,
          avatarKey: existing.avatarKey ?? profile.picture,
          accounts: {
            create: { provider: 'GOOGLE', providerAccountId: profile.sub, email: profile.email },
          },
        },
      });
      if (wasUnverified) await this.sessions.revokeAllForUser(existing.id);
      return user;
    }

    return this.prisma.user.create({
      data: {
        email: profile.email,
        emailVerifiedAt: new Date(),
        firstName: profile.firstName.slice(0, 60),
        lastName: profile.lastName?.slice(0, 60) ?? null,
        avatarKey: profile.picture,
        accounts: {
          create: { provider: 'GOOGLE', providerAccountId: profile.sub, email: profile.email },
        },
      },
    });
  }
}
