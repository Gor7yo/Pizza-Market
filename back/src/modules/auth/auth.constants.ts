export const ACCESS_COOKIE = 'access_token';
export const REFRESH_COOKIE = 'refresh_token';
export const OAUTH_STATE_COOKIE = 'oauth_state';

export const VERIFICATION_CODE_TTL_MINUTES = 15;
export const VERIFICATION_MAX_ATTEMPTS = 5;
export const VERIFICATION_RESEND_COOLDOWN_SECONDS = 60;

export const PASSWORD_RESET_TTL_MINUTES = 30;
export const PASSWORD_RESET_COOLDOWN_SECONDS = 60;

export const LOGIN_MAX_FAILURES = 10;
export const LOGIN_LOCKOUT_SECONDS = 15 * 60;

/** Two tabs refreshing with the same token at once must not be treated as theft. */
export const REFRESH_REUSE_GRACE_MS = 30_000;

export const OAUTH_STATE_TTL_SECONDS = 600;

export const redisKeys = {
  revokedSession: (sessionId: string) => `auth:revoked-session:${sessionId}`,
  loginFailures: (email: string) => `auth:login-fail:${email}`,
  verifyCooldown: (userId: string) => `auth:verify-cooldown:${userId}`,
  resetCooldown: (userId: string) => `auth:reset-cooldown:${userId}`,
  oauthState: (state: string) => `auth:oauth-state:${state}`,
};
