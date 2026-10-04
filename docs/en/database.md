# Database

**English** | [Русский](../ru/database.md)

PostgreSQL 17, Prisma ORM 7 (`prisma-client` generator, `@prisma/adapter-pg` driver adapter).
Schema: [`back/prisma/schema.prisma`](../../back/prisma/schema.prisma), config: `back/prisma.config.ts`.

## Conventions

- IDs are UUID v7 (`@default(uuid(7)) @db.Uuid`): time-sortable and not guessable.
- Money is `Int`, in minor units of the store currency.
- Translatable catalog texts are `Json` like `{"ru": "...", "en": "...", "hy": "..."}`,
  plus a denormalized `Product.searchText` (all translations, lowercased) for search.
- Nothing that orders reference is ever deleted: products, categories, ingredients and crusts
  are archived (`isArchived`). A promo code can be deleted only if it was never used.
- Cascades: user data (sessions, addresses, cart, favorites) is deleted with the user;
  orders use `Restrict` (users are blocked, not deleted).

## Entities

| Group      | Models                                                                                                                              |
| ---------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| Identity   | `User`, `Account` (OAuth), `Session`, `VerificationCode`, `PasswordResetToken`, `Address`                                           |
| Catalog    | `Category`, `Product`, `ProductSize`, `Crust`, `ProductCrust`, `Ingredient`, `ProductIngredient` (`DEFAULT`/`EXTRA`, `isRemovable`) |
| Customer   | `Favorite`, `Cart`, `CartItem` (configuration + `key` only), `Review`                                                               |
| Promotions | `PromoCode` (+ implicit m2m to products/categories), `PromoCodeUsage`                                                               |
| Orders     | `Order`, `OrderItem` (full snapshot), `OrderStatusHistory`, `Payment`                                                               |
| System     | `AuditLog`, `Setting`                                                                                                               |

## Database-level invariants

- `User.email` is unique (always lowercase); `Account(provider, providerAccountId)` is unique;
  `Account(userId, provider)` is unique.
- `Session.refreshTokenHash` / `previousTokenHash` are unique.
- `Favorite(userId, productId)` is a composite PK; `Review(userId, productId)` is unique.
- `CartItem(cartId, key)` is unique: identical configurations are one row.
- `Order(userId, idempotencyKey)` is unique to prevent duplicate orders; `Order.number` is a
  human-friendly autoincrement.
- `PromoCodeUsage.orderId` and `Payment.orderId` are unique.
- `ProductSize(productId, sizeCm)` is unique.
- Indexes match real queries: catalog by category/archive/availability, sorting, orders by
  user/status/date, audit by entity/actor/date, cleanup by `expiresAt`.

## Price snapshots

`OrderItem` stores the name, slug, image, size, crust name, removed and added ingredients (with
prices), the original configuration, `basePrice`, `sizeModifier`, `crustModifier`, `unitPrice`
and `lineTotal`. `Order` stores an address snapshot and the promo code text. Catalog changes
never alter past orders.

## Migrations

```bash
pnpm db:migrate          # prisma migrate dev     — create/apply a migration in development
pnpm db:deploy           # prisma migrate deploy  — apply in CI/production
pnpm db:seed             # load dev data (SEED_RESET=true wipes first)
pnpm db:studio
```

Migrations are committed (`back/prisma/migrations`). The production schema is never changed by
hand. The initial `init` migration is already in the repository; create new ones with
`pnpm db:migrate`.

Range checks (rating 1–5, percentage 1–100) are enforced by the API through the shared Zod
schemas; they can also be duplicated as `CHECK` constraints in an SQL migration.
