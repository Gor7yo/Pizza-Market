# База данных

[English](../en/database.md) | **Русский**

PostgreSQL 17, Prisma ORM 7 (генератор `prisma-client`, драйвер-адаптер `@prisma/adapter-pg`).
Схема: [`back/prisma/schema.prisma`](../../back/prisma/schema.prisma), конфиг: `back/prisma.config.ts`.

## Соглашения

- ID — UUID v7 (`@default(uuid(7)) @db.Uuid`): сортируемые по времени, не угадываемые.
- Деньги — `Int`, минимальные единицы валюты магазина.
- Переводимые тексты каталога — `Json` вида `{"ru": "...", "en": "...", "hy": "..."}`,
  плюс денормализованное `Product.searchText` (все переводы в нижнем регистре) для поиска.
- Ничего, на что ссылаются заказы, не удаляется: товары, категории, ингредиенты, борта
  архивируются (`isArchived`). Промокод удаляется только если не использовался.
- Каскады: данные пользователя (сессии, адреса, корзина, избранное) удаляются вместе с
  ним; заказы — `Restrict` (пользователей не удаляют, их блокируют).

## Сущности

| Группа       | Модели                                                                                                                              |
| ------------ | ----------------------------------------------------------------------------------------------------------------------------------- |
| Идентичность | `User`, `Account` (OAuth), `Session`, `VerificationCode`, `PasswordResetToken`, `Address`                                           |
| Каталог      | `Category`, `Product`, `ProductSize`, `Crust`, `ProductCrust`, `Ingredient`, `ProductIngredient` (`DEFAULT`/`EXTRA`, `isRemovable`) |
| Покупатель   | `Favorite`, `Cart`, `CartItem` (только конфигурация + `key`), `Review`                                                              |
| Промо        | `PromoCode` (+ неявные m2m на товары/категории), `PromoCodeUsage`                                                                   |
| Заказы       | `Order`, `OrderItem` (полный снимок), `OrderStatusHistory`, `Payment`                                                               |
| Система      | `AuditLog`, `Setting`                                                                                                               |

## Инварианты на уровне БД

- `User.email` unique (всегда в нижнем регистре); `Account(provider, providerAccountId)` unique;
  `Account(userId, provider)` unique.
- `Session.refreshTokenHash` / `previousTokenHash` unique.
- `Favorite(userId, productId)` — составной PK; `Review(userId, productId)` unique.
- `CartItem(cartId, key)` unique — одинаковые конфигурации = одна строка.
- `Order(userId, idempotencyKey)` unique — защита от двойных заказов; `Order.number` —
  автоинкремент для людей.
- `PromoCodeUsage.orderId` unique; `Payment.orderId` unique.
- `ProductSize(productId, sizeCm)` unique.
- Индексы под реальные запросы: каталог по категории/архиву/доступности, сортировки,
  заказы по пользователю/статусу/дате, аудит по сущности/актору/дате, очистка по `expiresAt`.

## Снимки цен

`OrderItem` хранит название, slug, картинку, размер, название борта, убранные и
добавленные ингредиенты (с ценами), исходную конфигурацию, `basePrice`, `sizeModifier`,
`crustModifier`, `unitPrice`, `lineTotal`. `Order` хранит снимок адреса и текст
промокода. Изменение каталога не меняет старые заказы.

## Миграции

```bash
pnpm db:migrate          # prisma migrate dev  — создать/применить миграцию в разработке
pnpm db:deploy           # prisma migrate deploy — применить в CI/production
pnpm db:seed             # заполнить dev-данными (SEED_RESET=true — с очисткой)
pnpm db:studio
```

Миграции коммитятся (`back/prisma/migrations`). Схему production никогда не меняют
вручную. Начальная миграция `init` уже в репозитории, новые создаются через `pnpm db:migrate`.

Проверки диапазонов (рейтинг 1–5, процент 1–100) выполняет API через общие Zod-схемы;
при желании их можно продублировать `CHECK`-ограничениями в SQL-миграции.
