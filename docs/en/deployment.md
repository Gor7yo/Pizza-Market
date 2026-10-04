# Deployment

**English** | [Русский](../ru/deployment.md)

## Components

| Service       | Image                                     | Port | Depends on             |
| ------------- | ----------------------------------------- | ---- | ---------------------- |
| web           | `docker/web.Dockerfile` (Next standalone) | 3000 | api (internal network) |
| api           | `docker/api.Dockerfile`                   | 4000 | PostgreSQL, Redis, S3  |
| PostgreSQL 17 | managed service or container              | 5432 | —                      |
| Redis 7       | managed service or container (AOF)        | 6379 | —                      |
| S3 storage    | AWS S3 / Cloudflare R2 / MinIO            | —    | —                      |

Only web is exposed publicly (behind a TLS terminator). The browser reaches the API through the
`web → api` rewrite (`API_INTERNAL_URL`), so `WEB_ORIGIN` is the public site URL and
`TRUST_PROXY` is the number of proxies in front of the API (load balancer + Next is usually 2).

## Required production settings

API (`back/.env`):

- `NODE_ENV=production`
- `DATABASE_URL`, `REDIS_URL`
- `JWT_ACCESS_SECRET`, `CODE_HMAC_SECRET`: different, random, at least 32 characters
  (`node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"`)
- `WEB_ORIGIN`, `PUBLIC_WEB_URL`: `https://…`
- `COOKIE_SECURE` defaults to `true` in production
- `EMAIL_PROVIDER=resend`, `RESEND_API_KEY`, `EMAIL_FROM` (domain verified in Resend)
- `S3_*` and `S3_PUBLIC_URL` (CDN/public bucket)
- `GOOGLE_*` if Google sign-in is needed; redirect URI = `https://<site>/api/v1/auth/google/callback`
- `GEOCODER_PROVIDER` / `NOMINATIM_URL`: the public Nominatim instance has strict limits
  (1 req/s); under real load use your own instance or a commercial geocoder
- do not set `DEV_ENDPOINTS_ENABLED` (validation forbids it); `SWAGGER_ENABLED=false`

Web (`front` build args/env): `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_DEFAULT_LOCALE`,
`API_INTERNAL_URL`, `IMAGE_REMOTE_HOSTS` (image CDN host).

The API configuration is validated at startup (`src/config/env.ts`): with invalid variables the
app refuses to start and prints the list of errors.

## Migrations

The API image runs `prisma migrate deploy` on startup, which is fine for a single instance.
With multiple replicas, run migrations as a separate release step (job) before rollout.

## Scaling

The API is stateless: sessions live in PostgreSQL, revocations/limits/cache in Redis and files
in S3, so you can run as many replicas as you need. BullMQ queues are processed by all
replicas; the cleanup scheduler is one per cluster (`upsertJobScheduler`).

## Observability

- Logs: JSON (pino) to stdout, with `requestId`, without secrets (redaction).
- `GET /api/v1/health` for liveness/readiness (503 when the database or Redis is unavailable).
- Failed BullMQ jobs are kept for 30 days (except emails containing secrets).

## Backups

Daily PostgreSQL backups (PITR on managed services) and S3 bucket versioning.
Redis holds only recoverable/temporary data.
