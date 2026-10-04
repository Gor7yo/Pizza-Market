<div align="center">

# 🍕 Tonir Pizza

**Full-stack интернет-магазин доставки пиццы для рынка Армении**

Next.js 16 · NestJS 11 · Prisma 7 · PostgreSQL · Redis · BullMQ · TypeScript

[English](README.md) | **Русский**

</div>

---

## Возможности

**Витрина**

- каталог с поиском, фильтрами и сортировкой;
- конструктор пиццы: размер, борт, убрать или добавить ингредиенты;
- корзина: работает без входа, синхронизируется с сервером, сливается при входе;
- избранное и промокоды;
- оформление заказа: доставка или самовывоз, адрес на карте, mock-оплата картой или наличные;
- отслеживание заказа с таймлайном, история заказов, повтор заказа;
- отзывы после покупки;
- личный кабинет с управлением активными сессиями;
- регистрация с подтверждением email, сброс пароля, вход через Google;
- интерфейс в стиле «жидкого стекла», адаптивный вплоть до телефона.

**Админка**

- дашборд по реальным данным;
- товары, категории, ингредиенты и борта;
- заказы со сменой статусов;
- пользователи, промокоды, модерация отзывов;
- журнал аудита и настройки магазина.

Языки: русский, английский, армянский. Валюта магазина — AMD, примерные цены в USD и RUB.

## Стек

|                           |                                                                                                                                                                                                      |
| ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Монорепозиторий           | pnpm workspaces + Turborepo                                                                                                                                                                          |
| Web (`front/`)            | Next.js 16 (App Router, React Compiler), React 19, TypeScript, CSS Modules + CSS-переменные, MobX, TanStack Query, React Hook Form + Zod, next-intl, Motion, Sonner, Leaflet, lucide-react           |
| API (`back/`)             | NestJS 11, Prisma 7 + PostgreSQL, Redis (ioredis), BullMQ, JWT в HttpOnly cookies, Google OAuth (PKCE), argon2id, Helmet, Throttler (Redis), pino, Swagger, Resend, S3 (локально — SeaweedFS), sharp |
| Общее (`packages/shared`) | Zod-схемы, DTO-типы, деньги, ценообразование, статусы заказа, коды ошибок                                                                                                                            |
| Тесты                     | Vitest (shared, web), Jest (API unit + integration), Playwright (E2E)                                                                                                                                |
| Инфраструктура            | Docker, Docker Compose, GitHub Actions                                                                                                                                                               |

Подробности — в [docs/ru/architecture.md](docs/ru/architecture.md).

## Требования

- Node.js ≥ 22.12, pnpm 11 (`corepack enable`)
- Docker (PostgreSQL, Redis, SeaweedFS как S3)

## Быстрый старт

```bash
pnpm install
cp back/.env.example back/.env
cp front/.env.example front/.env.local

pnpm infra:up      # postgres (порт 5433 на хосте), redis, s3 (SeaweedFS)
pnpm db:deploy     # применить миграции
pnpm db:seed       # демо-данные
pnpm dev           # shared (watch) + API :4000 + web :3000
```

- Сайт: http://localhost:3000
- Админка: http://localhost:3000/admin
- Swagger: http://localhost:4000/api/v1/docs
- Локальное S3-хранилище картинок: http://localhost:8333 (бакет `market` API создаёт при старте)

В разработке письма не отправляются: они выводятся в лог API (`EMAIL_PROVIDER=console`), там же виден код подтверждения.

### Демо-учётные записи (только для разработки)

| Роль         | E-mail              | Пароль       |
| ------------ | ------------------- | ------------ |
| Админ        | `admin@tonir.local` | `Admin12345` |
| Пользователь | `user@tonir.local`  | `User12345`  |
| Пользователь | `anna@tonir.local`  | `User12345`  |

Пароли можно переопределить через `SEED_ADMIN_PASSWORD` и `SEED_USER_PASSWORD`. Пересоздать данные: `SEED_RESET=true pnpm db:seed`.

Промокоды в сиде:

- `WELCOME10` — −10%, одно использование на клиента;
- `PIZZA1000` — −1000 ֏ при заказе от 6000 ֏;
- `PIZZALOVER` — −15% только на пиццы;
- `SUMMER2025` — истёкший, для проверки ошибки.

### Вход через Google (необязательно)

1. В Google Cloud Console создайте OAuth-клиент типа **Web application**.
2. Добавьте redirect URI `http://localhost:3000/api/v1/auth/google/callback`.
3. Пропишите `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` и `GOOGLE_REDIRECT_URI` в `back/.env` и перезапустите API.

## Переменные окружения

Все переменные описаны в файлах-примерах с комментариями:

- [`back/.env.example`](back/.env.example) — API. Переменные проверяются при старте: с ошибкой в конфиге приложение не запустится.
- [`front/.env.example`](front/.env.example) — веб.

Ключевые переменные:

| Переменная                                           | Где | Назначение                                 |
| ---------------------------------------------------- | --- | ------------------------------------------ |
| `DATABASE_URL`, `REDIS_URL`                          | API | подключения                                |
| `JWT_ACCESS_SECRET`, `CODE_HMAC_SECRET`              | API | секреты, не короче 32 символов             |
| `WEB_ORIGIN`, `PUBLIC_WEB_URL`                       | API | CORS и CSRF, ссылки в письмах              |
| `EMAIL_PROVIDER`, `RESEND_API_KEY`, `EMAIL_FROM`     | API | почта (`console` или `resend`)             |
| `S3_*`                                               | API | хранилище картинок                         |
| `GOOGLE_CLIENT_ID/SECRET/REDIRECT_URI`               | API | вход через Google (необязательно)          |
| `STORE_CURRENCY`, `STORE_TIMEZONE`                   | API | валюта и часовой пояс магазина             |
| `API_INTERNAL_URL`                                   | web | адрес API для сервера Next (rewrite и SSR) |
| `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_DEFAULT_LOCALE` | web | SEO и язык по умолчанию                    |

## Команды

```bash
pnpm dev                 # всё в режиме разработки
pnpm build               # сборка всех пакетов
pnpm lint                # ESLint
pnpm typecheck           # tsc --noEmit
pnpm test                # unit-тесты (shared, web, API)
pnpm test:integration    # интеграционные тесты API (нужны postgres + redis, БД market_test)
pnpm test:e2e            # Playwright (нужен запущенный стек с сидом)
pnpm format              # Prettier
pnpm db:migrate | db:deploy | db:seed | db:studio
```

### Интеграционные тесты

Используют отдельную базу `market_test`, которую создаёт `docker/postgres/init.sql`, и Redis DB 1.

```bash
pnpm infra:up
DATABASE_URL=postgresql://market:market@localhost:5433/market_test pnpm --filter @market/api exec prisma migrate deploy
pnpm test:integration
```

### E2E

Нужен API с `DEV_ENDPOINTS_ENABLED=true`, чтобы читать коды из писем, и свежий сид:

```bash
SEED_RESET=true pnpm db:seed
pnpm dev                                   # или build + start
pnpm --filter @market/web exec playwright install chromium
pnpm test:e2e
```

## Docker

```bash
pnpm infra:up                    # только инфраструктура для локальной разработки
docker compose up --build        # весь стек: postgres, redis, s3, api, web
```

API в контейнере применяет миграции при старте. О production — в [docs/ru/deployment.md](docs/ru/deployment.md).

## Структура

```
front/src/
  app/              маршруты: (store), (auth), admin, sitemap, robots
  components/       ui (дизайн-система), layout, common
  features/         auth, catalog, configurator, cart, checkout, orders, reviews, favorites, profile, admin
  stores/           MobX: корзина, конструктор, UI, оформление
  lib/              API-клиенты, query keys, деньги, ошибки, env
  i18n/, messages/  next-intl и переводы ru/en/hy
back/src/
  config/ common/ infrastructure/ modules/   (см. docs/ru/architecture.md)
back/prisma/        schema.prisma, migrations, seed.ts
packages/shared/    контракты и бизнес-правила, общие для web и API
```

## Документация

|                | English                                        | Русский                                        |
| -------------- | ---------------------------------------------- | ---------------------------------------------- |
| Архитектура    | [architecture.md](docs/en/architecture.md)     | [architecture.md](docs/ru/architecture.md)     |
| Аутентификация | [authentication.md](docs/en/authentication.md) | [authentication.md](docs/ru/authentication.md) |
| База данных    | [database.md](docs/en/database.md)             | [database.md](docs/ru/database.md)             |
| REST API       | [api.md](docs/en/api.md)                       | [api.md](docs/ru/api.md)                       |
| Деплой         | [deployment.md](docs/en/deployment.md)         | [deployment.md](docs/ru/deployment.md)         |

## Известные ограничения

- **Оплата.** Реализован только mock-провайдер; абстракция под реального провайдера (армянский эквайринг, Stripe) готова. Реальные деньги не списываются.
- **Отслеживание заказа.** Статус обновляется опросом раз в 15 секунд. Доменное событие для WebSocket уже есть.
- **Курсы USD и RUB.** Задаются админом вручную, автоматического обновления нет. В интерфейсе цены в этих валютах помечены «≈».
- **Переводы.** Армянский перевод покрывает витрину, вход и кабинет; админка на армянском откатывается на английский.
- **Доставка.** Одна точка и единый тариф: стоимость доставки и порог бесплатной доставки. Зоны доставки не реализованы.
- **Поиск.** Поиск подстроки по `searchText`. Для большого каталога стоит добавить `pg_trgm` или полнотекстовый индекс.
- **Картинки в сиде.** Фото берутся по ссылкам с Unsplash и Wikimedia Commons; если они недоступны, показывается градиентная заглушка.
- **Версия NestJS.** Бэкенд работает на Nest 11. Уже вышел Nest 12 (только ESM); обновление — отдельная задача.
