<div align="center">

# Tonir Pizza[https://web-production-72a2f.up.railway.app/]

**Full-stack pizza delivery store for the Armenian market**

Next.js 16 · NestJS 11 · Prisma 7 · PostgreSQL · Redis · BullMQ · TypeScript

**English** | [Русский](README.ru.md)

</div>

---

## Features

**Storefront**

- catalog with search, filters and sorting;
- pizza builder: size, crust, remove or add ingredients;
- cart: works without sign-in, syncs with the server, merges on sign-in;
- favorites and promo codes;
- checkout: delivery or pickup, address picked on a map, mock card payment or cash;
- order tracking with a timeline, order history, reorder;
- reviews after purchase;
- account page with active sessions management;
- sign-up with email verification, password reset, Google sign-in;
- "liquid glass" UI, responsive down to phone width.

**Admin panel**

- dashboard built on real data;
- products, categories, ingredients and crusts;
- orders with status workflow;
- users, promo codes, review moderation;
- audit log and store settings.

Languages: English, Russian, Armenian. Store currency is AMD, with approximate prices in USD and RUB.

## Tech stack

|                            |                                                                                                                                                                                                    |
| -------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Monorepo                   | pnpm workspaces + Turborepo                                                                                                                                                                        |
| Web (`front/`)             | Next.js 16 (App Router, React Compiler), React 19, TypeScript, CSS Modules + CSS custom properties, MobX, TanStack Query, React Hook Form + Zod, next-intl, Motion, Sonner, Leaflet, lucide-react  |
| API (`back/`)              | NestJS 11, Prisma 7 + PostgreSQL, Redis (ioredis), BullMQ, JWT in HttpOnly cookies, Google OAuth (PKCE), argon2id, Helmet, Throttler (Redis), pino, Swagger, Resend, S3 (SeaweedFS locally), sharp |
| Shared (`packages/shared`) | Zod schemas, DTO types, money, pricing, order statuses, error codes                                                                                                                                |
| Tests                      | Vitest (shared, web), Jest (API unit + integration), Playwright (E2E)                                                                                                                              |
| Infrastructure             | Docker, Docker Compose, GitHub Actions                                                                                                                                                             |

See [docs/en/architecture.md](docs/en/architecture.md) for details.

## Requirements

- Node.js ≥ 22.12, pnpm 11 (`corepack enable`)
- Docker (PostgreSQL, Redis, SeaweedFS as S3)

## Quick start

```bash
pnpm install
cp back/.env.example back/.env
cp front/.env.example front/.env.local

pnpm infra:up      # postgres (host port 5433), redis, s3 (SeaweedFS)
pnpm db:deploy     # apply migrations
pnpm db:seed       # demo data
pnpm dev           # shared (watch) + API :4000 + web :3000
```

- Store: http://localhost:3000
- Admin: http://localhost:3000/admin
- Swagger: http://localhost:4000/api/v1/docs
- Local S3 image storage: http://localhost:8333 (the API creates the `market` bucket on startup)

In development emails are not sent. They are printed to the API log (`EMAIL_PROVIDER=console`), including verification codes.

### Demo accounts (development only)

| Role  | Email               | Password     |
| ----- | ------------------- | ------------ |
| Admin | `admin@tonir.local` | `Admin12345` |
| User  | `user@tonir.local`  | `User12345`  |
| User  | `anna@tonir.local`  | `User12345`  |

Passwords can be overridden with `SEED_ADMIN_PASSWORD` and `SEED_USER_PASSWORD`. To recreate the data: `SEED_RESET=true pnpm db:seed`.

Seeded promo codes:

- `WELCOME10`: −10%, once per customer;
- `PIZZA1000`: −1000 ֏ on orders from 6000 ֏;
- `PIZZALOVER`: −15% on pizzas only;
- `SUMMER2025`: expired, for testing the error.

### Google sign-in (optional)

1. In Google Cloud Console create an OAuth client of type **Web application**.
2. Add the redirect URI `http://localhost:3000/api/v1/auth/google/callback`.
3. Put `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` and `GOOGLE_REDIRECT_URI` into `back/.env` and restart the API.

## Environment variables

All variables are documented in commented example files:

- [`back/.env.example`](back/.env.example): API. Variables are validated at startup; the app will not start with an invalid config.
- [`front/.env.example`](front/.env.example): web.

Key variables:

| Variable                                             | Where | Purpose                                           |
| ---------------------------------------------------- | ----- | ------------------------------------------------- |
| `DATABASE_URL`, `REDIS_URL`                          | API   | connections                                       |
| `JWT_ACCESS_SECRET`, `CODE_HMAC_SECRET`              | API   | secrets, at least 32 characters                   |
| `WEB_ORIGIN`, `PUBLIC_WEB_URL`                       | API   | CORS and CSRF, links in emails                    |
| `EMAIL_PROVIDER`, `RESEND_API_KEY`, `EMAIL_FROM`     | API   | email (`console` or `resend`)                     |
| `S3_*`                                               | API   | image storage                                     |
| `GOOGLE_CLIENT_ID/SECRET/REDIRECT_URI`               | API   | Google sign-in (optional)                         |
| `STORE_CURRENCY`, `STORE_TIMEZONE`                   | API   | store currency and timezone                       |
| `API_INTERNAL_URL`                                   | web   | API address for the Next server (rewrite and SSR) |
| `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_DEFAULT_LOCALE` | web   | SEO and default language                          |

## Scripts

```bash
pnpm dev                 # everything in dev mode
pnpm build               # build all packages
pnpm lint                # ESLint
pnpm typecheck           # tsc --noEmit
pnpm test                # unit tests (shared, web, API)
pnpm test:integration    # API integration tests (needs postgres + redis, market_test DB)
pnpm test:e2e            # Playwright (needs the running stack with seed data)
pnpm format              # Prettier
pnpm db:migrate | db:deploy | db:seed | db:studio
```

### Integration tests

They use a separate `market_test` database, created by `docker/postgres/init.sql`, and Redis DB 1.

```bash
pnpm infra:up
DATABASE_URL=postgresql://market:market@localhost:5433/market_test pnpm --filter @market/api exec prisma migrate deploy
pnpm test:integration
```

### E2E

Requires the API with `DEV_ENDPOINTS_ENABLED=true` (to read codes from emails) and fresh seed data:

```bash
SEED_RESET=true pnpm db:seed
pnpm dev                                   # or build + start
pnpm --filter @market/web exec playwright install chromium
pnpm test:e2e
```

## Docker

```bash
pnpm infra:up                    # infrastructure only, for local development
docker compose up --build        # full stack: postgres, redis, s3, api, web
```

The API container applies migrations on startup. For production see [docs/en/deployment.md](docs/en/deployment.md).

## Project structure

```
front/src/
  app/              routes: (store), (auth), admin, sitemap, robots
  components/       ui (design system), layout, common
  features/         auth, catalog, configurator, cart, checkout, orders, reviews, favorites, profile, admin
  stores/           MobX: cart, configurator, UI, checkout
  lib/              API clients, query keys, money, errors, env
  i18n/, messages/  next-intl and ru/en/hy translations
back/src/
  config/ common/ infrastructure/ modules/   (see docs/en/architecture.md)
back/prisma/        schema.prisma, migrations, seed.ts
packages/shared/    contracts and business rules shared by web and API
```

## Documentation

|                | English                                        | Русский                                        |
| -------------- | ---------------------------------------------- | ---------------------------------------------- |
| Architecture   | [architecture.md](docs/en/architecture.md)     | [architecture.md](docs/ru/architecture.md)     |
| Authentication | [authentication.md](docs/en/authentication.md) | [authentication.md](docs/ru/authentication.md) |
| Database       | [database.md](docs/en/database.md)             | [database.md](docs/ru/database.md)             |
| REST API       | [api.md](docs/en/api.md)                       | [api.md](docs/ru/api.md)                       |
| Deployment     | [deployment.md](docs/en/deployment.md)         | [deployment.md](docs/ru/deployment.md)         |

## Known limitations

- **Payments.** Only a mock provider is implemented; the abstraction for a real provider (Armenian acquiring, Stripe) is in place. No real money is charged.
- **Order tracking.** Status is updated by polling every 15 seconds. A domain event for WebSockets is ready.
- **USD and RUB rates.** Set manually by the admin, with no automatic updates. Prices in these currencies are marked "≈" in the UI.
- **Translations.** The Armenian translation covers the storefront, auth and account pages; the admin panel falls back to English in Armenian.
- **Delivery.** One store and a flat rate: delivery fee and a free delivery threshold. Delivery zones are not implemented.
- **Search.** Substring match on `searchText`. A large catalog would need `pg_trgm` or a full-text index.
- **Seed images.** Photos are linked from Unsplash and Wikimedia Commons; if unavailable, a gradient placeholder is shown.
- **NestJS version.** The backend runs on Nest 11. Nest 12 (ESM-only) is out; upgrading is a separate task.
