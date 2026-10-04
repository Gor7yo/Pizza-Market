# REST API

[English](../en/api.md) | **Русский**

Базовый префикс: `/api/v1`. Интерактивная документация (Swagger/OpenAPI):
`http://localhost:4000/api/v1/docs` (включена вне production или при `SWAGGER_ENABLED=true`).
Схемы запросов в Swagger генерируются из тех же Zod-схем, что и валидация.

## Соглашения

- JSON, деньги — целые минимальные единицы, даты — ISO 8601.
- Аутентификация — HttpOnly cookie `access_token` (для инструментов также `Authorization: Bearer`).
- Списки: `?page=&pageSize=` → `{ items, page, pageSize, total, totalPages }`.
- Лишние поля в теле запроса отклоняются (`400 VALIDATION_ERROR`).

### Формат ошибки (всегда один)

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

`code` — из `ERROR_CODES` (`packages/shared/src/errors.ts`), `fields` — ключи ошибок
валидации (переводятся во фронтенде), `requestId` совпадает с заголовком `X-Request-Id`
и логами.

| HTTP | Когда                                                                            |
| ---- | -------------------------------------------------------------------------------- |
| 400  | валидация, неверный код/токен                                                    |
| 401  | нет/просрочена сессия, неверные учётные данные                                   |
| 403  | нет прав, CSRF, неподтверждённый email, блокировка                               |
| 404  | не найдено (в т.ч. чужие ресурсы)                                                |
| 409  | конфликт (email занят, idempotency-конфликт, уникальность)                       |
| 422  | бизнес-правило (недоступный товар, промокод, минимальная сумма, переход статуса) |
| 429  | rate limit / блокировка попыток                                                  |

## Основные эндпоинты

**Auth** — `POST /auth/register`, `POST /auth/verify-email`, `POST /auth/resend-verification`,
`POST /auth/login`, `POST /auth/refresh`, `POST /auth/logout`, `POST /auth/logout-all`,
`GET /auth/me`, `POST /auth/forgot-password`, `POST /auth/reset-password`,
`GET /auth/providers`, `GET /auth/google`, `GET /auth/google/callback`.

**Профиль** — `PATCH /me`, `PUT /me/password`, `POST|DELETE /me/avatar`,
`GET /me/sessions`, `DELETE /me/sessions/:id`, `GET|POST /me/addresses`,
`PUT|DELETE /me/addresses/:id`, `GET /me/favorites`, `GET /me/favorites/ids`,
`PUT|DELETE /me/favorites/:productId`.

**Каталог (публично)** — `GET /categories`, `GET /products?q=&category=&tags=&sort=&page=`,
`GET /products/:slug`, `GET /products/:id/reviews`, `GET /settings`, `GET /sitemap-entries`.

**Корзина** — `POST /cart/quote` (публично: цены, скидка, доставка, итог),
`GET|PUT|DELETE /cart`, `POST /cart/merge`.

**Заказы** — `POST /orders` (заголовок `Idempotency-Key: <uuid>`; 201 — создан,
200 — повтор), `GET /orders`, `GET /orders/:id`, `POST /orders/:id/cancel`,
`POST /orders/:id/payment/mock-confirm`, `POST /orders/:id/payment/retry`.

**Отзывы** — `POST /reviews` (только после доставленного заказа с товаром).

**Гео** — `GET /geo/reverse?lat=&lng=`, `GET /geo/search?q=` (с кэшем и rate limit).

**Админка** (`ADMIN`) — `GET /admin/dashboard?days=`, `/admin/products` (+ `archive`,
`availability`), `POST /admin/uploads/:kind`, `/admin/categories`, `/admin/ingredients`,
`/admin/crusts`, `/admin/orders` (+ `PATCH :id/status`), `/admin/users`,
`/admin/promo-codes`, `/admin/reviews`, `/admin/audit-logs`, `GET|PUT /admin/settings`.

**Система** — `GET /health` (БД + Redis; 503 при деградации).
`GET /dev/emails` — только при `DEV_ENDPOINTS_ENABLED=true` (запрещено в production).

## Rate limits (на IP, Redis)

| Эндпоинт                             | Лимит                                                      |
| ------------------------------------ | ---------------------------------------------------------- |
| по умолчанию                         | 120 / мин                                                  |
| register                             | 5 / мин                                                    |
| login                                | 10 / мин (+ блокировка аккаунта после 10 неудач на 15 мин) |
| verify-email                         | 10 / мин (+ 5 попыток на код)                              |
| resend-verification, forgot-password | 3 / мин (+ cooldown 60 с на аккаунт)                       |
| reset-password                       | 5 / мин                                                    |
| google / callback                    | 20 / мин                                                   |
| orders (create)                      | 10 / мин                                                   |
| cart/quote                           | 60 / мин                                                   |
| geo                                  | 30 / мин                                                   |
