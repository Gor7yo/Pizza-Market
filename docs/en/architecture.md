# Architecture

**English** | [Русский](../ru/architecture.md)

Tonir Pizza is a pizza delivery store for the Armenian market. It is a pnpm + Turborepo monorepo:

```
market/
├── front/                  Next.js 16 (App Router): storefront + admin panel   (@market/web)
├── back/                   NestJS 11 + Prisma 7 + PostgreSQL + Redis           (@market/api)
├── packages/
│   ├── shared/             shared contracts: Zod schemas, DTO types, money,
│   │                       pricing, order statuses, error codes                (@market/shared)
│   ├── typescript-config/  base tsconfigs
│   └── eslint-config/      shared ESLint flat config
├── docker/                 Dockerfiles and init scripts
├── docs/
└── docker-compose.yml
```

## Principles

1. **The server is the single source of truth** for prices, discounts, statuses, roles and payments.
   The client sends only IDs and quantities.
2. **One contract for both sides.** Zod schemas in `@market/shared` validate forms on the
   frontend (React Hook Form) and requests in the API (`ZodValidationPipe`). Response types
   (`*Dto`) are shared too, so the frontend never guesses the response shape.
3. **Secure by default.** Every API route requires authentication unless marked `@Public()`;
   roles are checked by a global guard.
4. **Simple and maintainable.** Abstractions exist only where there is a real replacement point
   (payments, email, storage, geocoding, maps, notifications).

## Frontend (`front/`)

| Layer                   | What                                                                                              | Where                             |
| ----------------------- | ------------------------------------------------------------------------------------------------- | --------------------------------- |
| Routing                 | App Router; route groups `(store)`, `(auth)`, `admin`                                             | `src/app`                         |
| Server data             | Server Components + `serverApi()` (Next data cache for public data, `no-store` for personal data) | `src/lib/api/server.ts`           |
| Interactive server data | TanStack Query (caching, invalidation, optimistic updates, polling)                               | `src/lib/query`, `src/features/*` |
| Client state            | MobX: cart, pizza configurator, UI, checkout                                                      | `src/stores`                      |
| Forms                   | React Hook Form + Zod (shared schemas)                                                            | `src/features/*`, `src/app/**`    |
| Styles                  | CSS Modules + design tokens (CSS custom properties), "liquid glass" surfaces                      | `src/styles/tokens.css`           |
| i18n                    | next-intl (no URL prefix, locale in a cookie), ru / en / hy                                       | `src/i18n`, `messages/`           |
| Route protection        | `src/proxy.ts` (Next 16 proxy) + server-side check in `admin/layout.tsx` + the API                |                                   |

**MobX vs TanStack Query.** MobX holds client-only state: cart item configurations (without
prices), configurator selections, whether the cart drawer is open, display currency and
checkout steps. Everything server-owned (products, cart prices, orders, the user, admin data)
lives in TanStack Query. Cart prices always come from `POST /cart/quote`.

**Catalog filters** live in the URL, not in MobX: pages are shareable, the back button works
and the first page is server-rendered (SEO).

**React Compiler** is enabled. MobX `observer` components are marked with the `'use no memo'`
directive: the compiler memoizes by reference and cannot see observable mutations.

**The browser talks only to its own origin.** `next.config.ts` rewrites `/api/v1/*` to the
API, so auth cookies are first-party, the browser needs no CORS and the API address is not
exposed.

## Backend (`back/`)

Modular NestJS. Controllers are thin; business logic lives in services.

```
src/
├── config/              env schema (Zod), typed AppConfig
├── common/              errors, global filter, Zod pipe and decorators (+Swagger), guards
├── infrastructure/      prisma, redis, storage (S3), email (Resend/console + BullMQ), queues
└── modules/
    ├── auth/            sign-up, codes, sign-in, refresh rotation, Google OAuth, sessions, AuthGuard
    ├── users/           profile, avatar, addresses, admin user management
    ├── catalog/         public catalog + admin products/categories/ingredients/crusts
    ├── pricing/         PricingService (configuration validation + prices), PromoService, QuoteService
    ├── cart/            server-side cart, merge, quote
    ├── orders/          order creation (transaction + idempotency), statuses, admin
    ├── payments/        PaymentProvider abstraction + MockPaymentProvider
    ├── notifications/   domain event subscribers → channels (email; push/SMS ready)
    ├── reviews/         reviews only after purchase, moderation, rating recalculation
    ├── favorites/ promo/ settings/ dashboard/ audit/ geo/ maintenance/ dev/
```

### Pricing

`PricingService.resolve()` takes `{productId, sizeId, crustId, removedIngredientIds,
extraIngredientIds, quantity}` and checks each line item: the product exists, is not archived
and is available; the size belongs to the product; the crust is allowed; removed ingredients
are part of the recipe and `isRemovable`; extras have the `EXTRA` role and are available.
It then computes `base + size + crust + extras` using the shared functions from
`@market/shared/pricing`. `QuoteService` adds the promo code, delivery and the total. The same
code runs inside the order creation transaction.

### Order creation

`OrdersService.create()` runs in a single Prisma transaction:
1–7. recalculates the cart and checks availability, options, promo code, minimum order and delivery;
8–9. creates the order and its items with a **snapshot** (name, size, crust, ingredients, prices); 10. creates the payment via `PaymentsService` → `PaymentProvider`; 11. clears the server-side cart; 12. writes the initial status history entry.

Idempotency: an `Idempotency-Key` header (UUID), a unique index on `(userId, idempotencyKey)`
and a SHA-256 hash of the request body. A retry with the same key returns the same order (200);
a different body returns `409 IDEMPOTENCY_CONFLICT`. Two identical concurrent requests are
resolved by the unique index.

### Order statuses

The transition graph lives in `@market/shared/order-status.ts` and is used by both the API and
the UI. Only `OrderStatusService.transition()` changes a status. It provides optimistic locking
on the current status, history, an audit entry (for admins), payment sync (cash → paid on
handover; cancelling a paid order → refund via the provider) and an `order.status_changed`
event after commit.

### Background jobs (BullMQ)

| Queue         | Jobs                                                | Properties                                                                                                               |
| ------------- | --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `email`       | all transactional emails                            | 5 attempts with exponential backoff; jobId for idempotency; emails containing secrets are removed right after processing |
| `maintenance` | daily cleanup of expired sessions, codes and tokens | job scheduler (one job per cluster), idempotent                                                                          |

### Redis

Used only where it is justified: shared rate limiting (`RedisThrottlerStorage`), sign-in lockout
after failed attempts, revoked sessions (instant access token invalidation), cooldowns for codes
and password resets, OAuth state, cached store settings (read on every quote) and geocoding
results, and BullMQ queues.

### File storage

`FileStorage` (abstract class) → `S3FileStorage` (AWS S3 / Cloudflare R2 / MinIO / SeaweedFS in
development). `ImageService` decodes uploads with sharp (it does not trust MIME types or
extensions), strips metadata, applies EXIF rotation, downsizes and re-encodes to WebP. Keys
contain a UUID, so files are served with `Cache-Control: immutable`.

### Payments

`PaymentProvider` is a `createPayment` / `refund` contract. Only a **mock provider** is
implemented: the payment is created as `PENDING`, the customer lands on a test page
`/checkout/pay/:id` and the server applies the result (`mock-confirm` plays the role of the
provider callback). A real provider (Armenian acquiring, Stripe) must confirm payments only via
a signed server-to-server callback.

### Notifications

Orders publish domain events (`@nestjs/event-emitter`); `NotificationsService` subscribes to them
and fans out to `NotificationChannel[]`. There is one channel today, email. Push or SMS can be
added as a new class without touching orders.

## Money and currencies

All amounts are **integers in minor units** of the store currency (`STORE_CURRENCY`, AMD by
default with 0 decimal places; USD/RUB use 2). Floating point is never used for money:
percentages use integer rounding and conversion uses BigInt. USD/RUB are shown only as
approximate ("≈") values based on rates the admin sets manually (the update date is stored).
Orders are always in the store currency.

## Security boundaries

| Threat                                         | Mitigation                                                                                             |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| Tampering with prices/discounts/statuses/roles | the server recalculates everything; strict schemas reject unknown fields (mass assignment)             |
| IDOR                                           | every user-scoped query is filtered by `userId`; someone else's resource = 404                         |
| CSRF                                           | SameSite=Lax cookies + JSON-only + `Origin`/`Referer` check (`OriginGuard`)                            |
| XSS                                            | React escaping, CSP, HttpOnly cookies (tokens are not readable from JS)                                |
| Brute force                                    | global and per-route rate limiting in Redis, account lockout after 10 failures, per-code attempt limit |
| Database leak                                  | passwords: argon2id; refresh and reset tokens: SHA-256; codes: HMAC with a secret                      |
| Refresh token theft                            | rotation on every refresh; reuse of an old token revokes the session                                   |
| File uploads                                   | 5 MB limit, sharp decoding, WebP re-encoding, random keys                                              |
| Leaks via errors/logs                          | a single error format without stack traces; pino redaction for cookies/tokens/passwords                |
| Headers                                        | Helmet in the API; CSP, HSTS, X-Frame-Options, Referrer-Policy in Next                                 |

## Extensibility

Extension points are prepared without premature implementation: real payments
(`PaymentProvider`), push/SMS (`NotificationChannel`), real-time tracking
(`order.status_changed` events → a WebSocket gateway instead of polling), other map providers
(`TILE_PROVIDERS`, `GeocodingProvider`), multiple stores/delivery zones (delivery pricing is
isolated in `calculateDeliveryFee`) and loyalty programs (transactional order creation + audit).
