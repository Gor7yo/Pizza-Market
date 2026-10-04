import { Injectable } from '@nestjs/common';
import {
  type CartItemInput,
  cartItemKey,
  mergeCartItems,
  type ServerCartDto,
} from '@market/shared';
import type { Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';

/**
 * Server-side cart of authenticated users. Stores configurations only;
 * prices are produced by QuoteService on every read.
 */
@Injectable()
export class CartService {
  constructor(private readonly prisma: PrismaService) {}

  async get(userId: string): Promise<ServerCartDto> {
    const cart = await this.prisma.cart.findUnique({
      where: { userId },
      include: { items: { orderBy: { position: 'asc' } } },
    });
    if (!cart) return { items: [], updatedAt: null };
    return {
      items: cart.items.map((i) => ({
        productId: i.productId,
        sizeId: i.sizeId,
        crustId: i.crustId,
        removedIngredientIds: i.removedIngredientIds,
        extraIngredientIds: i.extraIngredientIds,
        quantity: i.quantity,
      })),
      updatedAt: cart.updatedAt.toISOString(),
    };
  }

  async replace(
    userId: string,
    items: readonly CartItemInput[],
    tx?: Prisma.TransactionClient,
  ): Promise<ServerCartDto> {
    const run = async (db: Prisma.TransactionClient) => {
      const merged = mergeCartItems([], items);
      // Drop lines whose product no longer exists (FK) - availability is reported by quotes.
      const existing = new Set(
        (
          await db.product.findMany({
            where: { id: { in: merged.map((i) => i.productId) } },
            select: { id: true },
          })
        ).map((p) => p.id),
      );
      const valid = merged.filter((i) => existing.has(i.productId));

      const cart = await db.cart.upsert({
        where: { userId },
        create: { userId },
        update: { updatedAt: new Date() },
      });
      await db.cartItem.deleteMany({ where: { cartId: cart.id } });
      if (valid.length) {
        await db.cartItem.createMany({
          data: valid.map((i, position) => ({
            cartId: cart.id,
            key: cartItemKey(i),
            productId: i.productId,
            sizeId: i.sizeId,
            crustId: i.crustId,
            removedIngredientIds: i.removedIngredientIds,
            extraIngredientIds: i.extraIngredientIds,
            quantity: i.quantity,
            position,
          })),
        });
      }
    };
    if (tx) await run(tx);
    else await this.prisma.$transaction(run);
    return this.get(userId);
  }

  /** Login merge: server lines first, then anonymous lines; equal configurations add up. */
  async merge(userId: string, incoming: readonly CartItemInput[]): Promise<ServerCartDto> {
    const current = await this.get(userId);
    return this.replace(userId, mergeCartItems(current.items, incoming));
  }

  async clear(userId: string, tx?: Prisma.TransactionClient): Promise<void> {
    const db = tx ?? this.prisma;
    await db.cartItem.deleteMany({ where: { cart: { userId } } });
  }
}
