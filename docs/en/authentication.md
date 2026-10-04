# Authentication and authorization

**English** | [Русский](../ru/authentication.md)

## Tokens and cookies

| Cookie          | Contents                     | Lifetime                                    | Flags                                                |
| --------------- | ---------------------------- | ------------------------------------------- | ---------------------------------------------------- |
| `access_token`  | JWT HS256 `{sub, role, sid}` | 15 min (`JWT_ACCESS_TTL_SECONDS`)           | HttpOnly, SameSite=Lax, Secure in production, Path=/ |
| `refresh_token` | 256 random bits (not a JWT)  | 30 days, sliding (`REFRESH_TOKEN_TTL_DAYS`) | HttpOnly, SameSite=Lax, Secure in production, Path=/ |
| `oauth_state`   | Google OAuth state           | 10 min                                      | HttpOnly                                             |

Tokens never reach JavaScript, localStorage or URLs.

The `Session` table stores only `sha256(refresh_token)`.

- **Rotation.** Every `POST /auth/refresh` issues a new token; the old hash moves to `previousTokenHash`.
- **Reuse detection.** Presenting an already-rotated token (outside a 30-second grace window for parallel tabs) signals theft, and the session is revoked.
- **Instant revocation.** Revoked session IDs are stored in Redis for the access token lifetime, so logout and "sign out everywhere" take effect immediately.

## Flows

**Sign-up.** `POST /auth/register` creates an unverified user (argon2id) and queues an email with a 6-digit code. The code:

- is stored as HMAC-SHA256 with `CODE_HMAC_SECRET`;
- is valid for 15 minutes and allows 5 attempts;
- is single-use: issuing a new code invalidates older ones;
- can be resent at most once every 60 seconds, with a rate limit.

`POST /auth/verify-email` verifies the address and creates a session right away.

**Sign-in.** `POST /auth/login`. For unknown emails a dummy argon2 check runs so the response time does not differ. After 10 failed attempts the account is locked for 15 minutes (per email, in Redis). `EMAIL_NOT_VERIFIED` is returned only when the password is correct.

**Password reset.**

1. `POST /auth/forgot-password` always responds with 204, so it does not reveal whether an email exists.
2. Token: 256 bits; the database stores its SHA-256; valid for 30 minutes; single-use.
3. The link points to `/reset-password#token=…`. The token is in the URL fragment, so it is never sent to servers and never appears in logs.
4. `POST /auth/reset-password` changes the password, revokes all sessions and sends a notification.

**Google OAuth.** Authorization code + PKCE + state:

1. `GET /auth/google?returnTo=/path` stores the state and code_verifier in Redis and the state in a cookie as well.
2. Google redirects the user to `GOOGLE_REDIRECT_URI`. This is a web app URL proxied to the API, so cookies stay first-party.
3. The ID token is verified with `google-auth-library`; `email_verified=true` is required.

Account linking rules:

- known Google account: sign in as the linked user;
- email matches an existing user: link without creating a duplicate. If the local account was never verified, its password is dropped and its sessions are revoked. This prevents takeover of an account pre-registered with someone else's email;
- otherwise: create a new verified user without a password. A password can be set later in the account page.

`returnTo` accepts only relative paths, so there are no open redirects.

## Authorization

```
Request → ThrottlerGuard → OriginGuard (CSRF) → AuthGuard (JWT + session revocation + roles) → Controller → Service
```

- Every route requires sign-in unless marked `@Public()`.
- `@AdminOnly()` (`@Roles('ADMIN')`) is checked centrally in `AuthGuard`.
- Changing a user's role or blocking them revokes all their sessions, because the role is embedded in the access token.
- Access to user resources (orders, addresses, sessions, payments) is always filtered by `userId`.

## Frontend

- `src/proxy.ts` (Next 16 proxy):
  - if the access token has expired or is about to expire and a refresh token exists, it refreshes the session in advance and forwards the new cookies to Server Components in the same request;
  - redirects anonymous users from `/account`, `/orders`, `/checkout`, `/admin` to `/login?next=…`.
- `admin/layout.tsx` checks the role via `GET /auth/me` before rendering the admin panel.
- On a 401 the client-side `api()` calls `/auth/refresh` once (single-flight) and retries the request.
- Cart: after sign-in the anonymous cart is merged into the server cart (`POST /cart/merge`), and identical configurations are combined. After sign-out the cart on the device is cleared.
