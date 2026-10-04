# Деплой

[English](../en/deployment.md) | **Русский**

## Компоненты

| Сервис        | Образ                                     | Порт | Зависимости              |
| ------------- | ----------------------------------------- | ---- | ------------------------ |
| web           | `docker/web.Dockerfile` (Next standalone) | 3000 | api (по внутренней сети) |
| api           | `docker/api.Dockerfile`                   | 4000 | PostgreSQL, Redis, S3    |
| PostgreSQL 17 | управляемый сервис или контейнер          | 5432 | —                        |
| Redis 7       | управляемый сервис или контейнер (AOF)    | 6379 | —                        |
| S3-хранилище  | AWS S3 / Cloudflare R2 / MinIO            | —    | —                        |

Публично открыт только web (за TLS-терминатором). Браузер ходит в API через
rewrite `web → api` (`API_INTERNAL_URL`), поэтому `WEB_ORIGIN` = публичный URL сайта,
а `TRUST_PROXY` = число прокси перед API (балансировщик + Next = обычно 2).

## Обязательные настройки production

API (`back/.env`):

- `NODE_ENV=production`
- `DATABASE_URL`, `REDIS_URL`
- `JWT_ACCESS_SECRET`, `CODE_HMAC_SECRET` — разные, случайные, ≥ 32 символов
  (`node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"`)
- `WEB_ORIGIN`, `PUBLIC_WEB_URL` — `https://…`
- `COOKIE_SECURE` по умолчанию `true` в production
- `EMAIL_PROVIDER=resend`, `RESEND_API_KEY`, `EMAIL_FROM` (домен подтверждён в Resend)
- `S3_*` и `S3_PUBLIC_URL` (CDN/публичный бакет)
- `GOOGLE_*` — при необходимости Google-входа; redirect URI = `https://<site>/api/v1/auth/google/callback`
- `GEOCODER_PROVIDER` / `NOMINATIM_URL` — публичный Nominatim имеет жёсткие лимиты
  (1 req/s); для нагрузки нужен свой инстанс или коммерческий геокодер
- `DEV_ENDPOINTS_ENABLED` не задавать (запрещено валидацией), `SWAGGER_ENABLED=false`

Web (`front` build args/env): `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_DEFAULT_LOCALE`,
`API_INTERNAL_URL`, `IMAGE_REMOTE_HOSTS` (хост CDN картинок).

Конфигурация API проверяется при старте (`src/config/env.ts`) — с некорректными
переменными приложение не запустится и выведет список ошибок.

## Миграции

Образ API выполняет `prisma migrate deploy` при старте — подходит для одного экземпляра.
При нескольких репликах запускайте миграции отдельным шагом релиза (job) до раскатки.

## Масштабирование

API stateless: сессии в PostgreSQL, отзывы/лимиты/кэш в Redis, файлы в S3 — реплик
можно запускать сколько угодно. Очереди BullMQ обрабатываются всеми репликами;
планировщик очистки — один на кластер (`upsertJobScheduler`).

## Наблюдаемость

- Логи — JSON (pino) в stdout, с `requestId`, без секретов (redaction).
- `GET /api/v1/health` — для liveness/readiness (503 при недоступности БД/Redis).
- Неудачные задачи BullMQ хранятся 30 дней (кроме писем с секретами).

## Бэкапы

Ежедневный бэкап PostgreSQL (PITR у управляемых сервисов), версионирование бакета S3.
Redis содержит только восстановимые/временные данные.
