# REST API

**English** | [Русский](../ru/api.md)

Base prefix: `/api/v1`. Interactive documentation (Swagger/OpenAPI):
`http://localhost:4000/api/v1/docs` (enabled outside production or with `SWAGGER_ENABLED=true`).
Request schemas in Swagger are generated from the same Zod schemas used for validation.

## Conventions

- JSON; money in integer minor units; dates in ISO 8601.
- Authentication: the HttpOnly `access_token` cookie (`Authorization: Bearer` is also accepted for tooling).
- Lists: `?page=&pageSize=` → `{ items, page, pageSize, total, totalPages }`.
- Unknown fields in a request body are rejected (`400 VALIDATION_ERROR`).

### Error format (always the same)

```json
{
  "error": {
    "code": "PROMO_EXPIRED",
    "message": "Promo code cannot be applied",
    "fields": { "email": "email" },
    "requestId": "…"
  }
}
```

`code` comes from `ERROR_CODES` (`packages/shared/src/errors.ts`); `fields` holds validation
error keys (translated on the frontend); `requestId` matches the `X-Request-Id` header and the
logs.

| HTTP | When                                                                              |
| ---- | --------------------------------------------------------------------------------- |
| 400  | validation, invalid code/token                                                    |
| 401  | missing/expired session, invalid credentials                                      |
| 403  | insufficient permissions, CSRF, unverified email, blocked account                 |
| 404  | not found (including other users' resources)                                      |
| 409  | conflict (email taken, idempotency conflict, uniqueness)                          |
| 422  | business rule (unavailable product, promo code, minimum order, status transition) |
| 429  | rate limit / attempt lockout                                                      |

## Main endpoints

**Auth**: `POST /auth/register`, `POST /auth/verify-email`, `POST /auth/resend-verification`,
`POST /auth/login`, `POST /auth/refresh`, `POST /auth/logout`, `POST /auth/logout-all`,
`GET /auth/me`, `POST /auth/forgot-password`, `POST /auth/reset-password`,
`GET /auth/providers`, `GET /auth/google`, `GET /auth/google/callback`.

**Profile**: `PATCH /me`, `PUT /me/password`, `POST|DELETE /me/avatar`,
`GET /me/sessions`, `DELETE /me/sessions/:id`, `GET|POST /me/addresses`,
`PUT|DELETE /me/addresses/:id`, `GET /me/favorites`, `GET /me/favorites/ids`,
`PUT|DELETE /me/favorites/:productId`.

**Catalog (public)**: `GET /categories`, `GET /products?q=&category=&tags=&sort=&page=`,
`GET /products/:slug`, `GET /products/:id/reviews`, `GET /settings`, `GET /sitemap-entries`.

**Cart**: `POST /cart/quote` (public: prices, discount, delivery, total),
`GET|PUT|DELETE /cart`, `POST /cart/merge`.

**Orders**: `POST /orders` (header `Idempotency-Key: <uuid>`; 201 = created,
200 = replay), `GET /orders`, `GET /orders/:id`, `POST /orders/:id/cancel`,
`POST /orders/:id/payment/mock-confirm`, `POST /orders/:id/payment/retry`.

**Reviews**: `POST /reviews` (only after a delivered order containing the product).

**Geo**: `GET /geo/reverse?lat=&lng=`, `GET /geo/search?q=` (cached and rate limited).

**Admin** (`ADMIN`): `GET /admin/dashboard?days=`, `/admin/products` (+ `archive`,
`availability`), `POST /admin/uploads/:kind`, `/admin/categories`, `/admin/ingredients`,
`/admin/crusts`, `/admin/orders` (+ `PATCH :id/status`), `/admin/users`,
`/admin/promo-codes`, `/admin/reviews`, `/admin/audit-logs`, `GET|PUT /admin/settings`.

**System**: `GET /health` (database + Redis; 503 when degraded).
`GET /dev/emails` only with `DEV_ENDPOINTS_ENABLED=true` (forbidden in production).

## Rate limits (per IP, Redis)

| Endpoint                             | Limit                                                     |
| ------------------------------------ | --------------------------------------------------------- |
| default                              | 120 / min                                                 |
| register                             | 5 / min                                                   |
| login                                | 10 / min (+ account lockout for 15 min after 10 failures) |
| verify-email                         | 10 / min (+ 5 attempts per code)                          |
| resend-verification, forgot-password | 3 / min (+ 60 s per-account cooldown)                     |
| reset-password                       | 5 / min                                                   |
| google / callback                    | 20 / min                                                  |
| orders (create)                      | 10 / min                                                  |
| cart/quote                           | 60 / min                                                  |
| geo                                  | 30 / min                                                  |
