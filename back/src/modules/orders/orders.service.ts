import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  CUSTOMER_CANCELLABLE_STATUSES,
  type createOrderSchema,
  type OrderAddressDto,
  type OrderDetailDto,
  type orderListQuerySchema,
  type OrderSummaryDto,
  type Paginated,
} from '@market/shared';
import type { z } from 'zod';
import type { ClientInfo } from '../../common/auth/decorators';
import { AppException } from '../../common/errors/app.exception';
import { sha256 } from '../../common/utils/crypto';
import { pageArgs, paginated } from '../../common/utils/pagination';
import { Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { FileStorage } from '../../infrastructure/storage/file-storage';
import { CartService } from '../cart/cart.service';
import { PaymentsService } from '../payments/payments.service';
import { PromoService } from '../pricing/promo.service';
import { QuoteService } from '../pricing/quote.service';
import { AddressesService } from '../users/addresses.service';
import { ORDER_EVENTS, type OrderCreatedEvent } from './order.events';
import { OrderStatusService } from './order-status.service';
import { orderDetailInclude, toOrderDetail, toOrderSummary } from './orders.mapper';

type CreateOrderData = z.output<typeof createOrderSchema>;

/** Deterministic JSON (sorted keys) so equal payloads always hash the same. */
export function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => a.localeCompare(b));
    return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${stableStringify(v)}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly quotes: QuoteService,
    private readonly promos: PromoService,
    private readonly payments: PaymentsService,
    private readonly addresses: AddressesService,
    private readonly cart: CartService,
    private readonly status: OrderStatusService,
    private readonly storage: FileStorage,
    private readonly events: EventEmitter2,
  ) {}

  /**
   * Creates an order atomically. Prices, discount and delivery fee are recalculated
   * from the catalog; the client only sends identifiers. The Idempotency-Key makes
   * retries/double clicks return the same order instead of creating a new one.
   */
  async create(
    userId: string,
    input: CreateOrderData,
    idempotencyKey: string,
    _client: ClientInfo,
  ): Promise<{ order: OrderDetailDto; created: boolean }> {
    const requestHash = sha256(stableStringify(input));
    const existing = await this.findByIdempotencyKey(userId, idempotencyKey, requestHash);
    if (existing) return { order: existing, created: false };

    let orderId: string;
    try {
      orderId = await this.prisma.$transaction(
        (tx) => this.createInTransaction(tx, userId, input, idempotencyKey, requestHash),
        { timeout: 15_000 },
      );
    } catch (err) {
      // Two identical requests raced: the unique (userId, idempotencyKey) index let one win.
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        const winner = await this.findByIdempotencyKey(userId, idempotencyKey, requestHash);
        if (winner) return { order: winner, created: false };
      }
      throw err;
    }

    this.events.emit(ORDER_EVENTS.created, { orderId } satisfies OrderCreatedEvent);
    this.logger.log(`Order ${orderId} created by user ${userId}`);
    return { order: await this.getForUser(userId, orderId), created: true };
  }

  private async findByIdempotencyKey(
    userId: string,
    idempotencyKey: string,
    requestHash: string,
  ): Promise<OrderDetailDto | null> {
    const order = await this.prisma.order.findUnique({
      where: { userId_idempotencyKey: { userId, idempotencyKey } },
      select: { id: true, requestHash: true },
    });
    if (!order) return null;
    if (order.requestHash !== requestHash) {
      throw AppException.conflict(
        'IDEMPOTENCY_CONFLICT',
        'Idempotency key was used for a different request',
      );
    }
    return this.getForUser(userId, order.id);
  }

  private async createInTransaction(
    tx: Prisma.TransactionClient,
    userId: string,
    input: CreateOrderData,
    idempotencyKey: string,
    requestHash: string,
  ): Promise<string> {
    // 1-7: validate products/options, recalculate prices, promo, delivery and total
    const {
      lines,
      promo,
      settings,
      dto: quote,
    } = await this.quotes.quote(
      { items: input.items, promoCode: input.promoCode, fulfillment: input.fulfillment, userId },
      tx,
    );
    if (!settings.isAcceptingOrders)
      throw AppException.unprocessable('STORE_CLOSED', 'The store is not accepting orders');

    const unavailable = lines.find((l) => !l.available);
    if (unavailable) {
      throw AppException.unprocessable(
        unavailable.reason ?? 'PRODUCT_UNAVAILABLE',
        'Some items are unavailable',
      );
    }
    if (lines.length === 0) throw AppException.unprocessable('CART_EMPTY', 'Cart is empty');
    if (promo && !promo.ok)
      throw AppException.unprocessable(promo.errorCode, 'Promo code cannot be applied');
    if (quote.subtotal - quote.discount < settings.minOrderAmount) {
      throw AppException.unprocessable('MIN_ORDER_AMOUNT', 'Order amount is below the minimum');
    }

    const user = await tx.user.findUniqueOrThrow({ where: { id: userId } });
    if (user.isBlocked) throw AppException.forbidden('ACCOUNT_BLOCKED');

    const address = await this.resolveAddress(tx, userId, input);

    // 8-9: order + snapshotted items, 12: initial status history
    const order = await tx.order.create({
      data: {
        userId,
        status: 'PENDING',
        fulfillment: input.fulfillment,
        currency: quote.currency,
        subtotal: quote.subtotal,
        discount: quote.discount,
        deliveryFee: quote.deliveryFee,
        total: quote.total,
        promoCodeId: promo?.ok ? promo.promo.id : null,
        promoCodeText: promo?.ok ? promo.promo.code : null,
        contactName: input.contactName,
        contactPhone: input.contactPhone,
        comment: input.comment || null,
        // omitted optional Json columns stay NULL
        address: address ? (address as unknown as Prisma.InputJsonObject) : undefined,
        idempotencyKey,
        requestHash,
        items: {
          create: lines.map((l) => ({
            productId: l.product?.id ?? null,
            productSlug: l.product?.slug ?? null,
            name: l.product?.name ?? {},
            imageKey: l.product?.imageKey ?? null,
            sizeId: l.size?.id ?? null,
            sizeCm: l.size?.sizeCm ?? null,
            crustId: l.crust?.id ?? null,
            crustName: l.crust ? (l.crust.name as Prisma.InputJsonObject) : undefined,
            removedIngredients: l.removed as unknown as Prisma.InputJsonArray,
            extraIngredients: l.extras as unknown as Prisma.InputJsonArray,
            configuration: l.input as unknown as Prisma.InputJsonObject,
            basePrice: l.product?.basePrice ?? 0,
            sizeModifier: l.size?.priceModifier ?? 0,
            crustModifier: l.crust?.priceModifier ?? 0,
            unitPrice: l.unitPrice,
            quantity: l.input.quantity,
            lineTotal: l.lineTotal,
          })),
        },
        history: {
          create: {
            fromStatus: null,
            toStatus: 'PENDING',
            note: 'Order created',
            changedById: userId,
          },
        },
      },
    });

    if (promo?.ok) {
      const consumed = await this.promos.consume(promo.promo, userId, order.id, tx);
      if (!consumed)
        throw AppException.unprocessable('PROMO_USAGE_LIMIT', 'Promo code usage limit reached');
    }

    // 10: payment record through the provider abstraction
    await this.payments.createForOrder(order, input.paymentMethod, tx);

    for (const l of lines) {
      if (l.product) {
        await tx.product.update({
          where: { id: l.product.id },
          data: { soldCount: { increment: l.input.quantity } },
        });
      }
    }

    // 11: the ordered items leave the server cart
    await this.cart.clear(userId, tx);
    return order.id;
  }

  private async resolveAddress(
    tx: Prisma.TransactionClient,
    userId: string,
    input: CreateOrderData,
  ): Promise<OrderAddressDto | null> {
    if (input.fulfillment === 'PICKUP') return null;

    if (input.addressId) {
      const a = await this.addresses.getOwned(userId, input.addressId, tx);
      return {
        country: a.country,
        city: a.city,
        street: a.street,
        apartment: a.apartment,
        entrance: a.entrance,
        floor: a.floor,
        intercom: a.intercom,
        instructions: a.instructions,
        latitude: a.latitude,
        longitude: a.longitude,
      };
    }
    const a = input.address;
    if (!a) throw AppException.badRequest('ADDRESS_REQUIRED', 'Delivery address is required');
    if (input.saveAddress) await this.addresses.create(userId, a, tx);
    return {
      country: a.country,
      city: a.city,
      street: a.street,
      apartment: a.apartment || null,
      entrance: a.entrance || null,
      floor: a.floor || null,
      intercom: a.intercom || null,
      instructions: a.instructions || null,
      latitude: a.latitude ?? null,
      longitude: a.longitude ?? null,
    };
  }

  async listForUser(
    userId: string,
    query: z.output<typeof orderListQuerySchema>,
  ): Promise<Paginated<OrderSummaryDto>> {
    const where: Prisma.OrderWhereInput = { userId, status: query.status };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.order.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        include: { items: { select: { quantity: true } }, payment: { select: { status: true } } },
        ...pageArgs(query.page, query.pageSize),
      }),
      this.prisma.order.count({ where }),
    ]);
    return paginated(rows.map(toOrderSummary), total, query.page, query.pageSize);
  }

  /** Scoped by userId: other users' orders are indistinguishable from missing ones (IDOR). */
  async getForUser(userId: string, orderId: string): Promise<OrderDetailDto> {
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, userId },
      include: orderDetailInclude,
    });
    if (!order) throw AppException.notFound('Order');

    let reviewable: string[] = [];
    if (order.status === 'DELIVERED') {
      const productIds = [
        ...new Set(order.items.flatMap((i) => (i.productId ? [i.productId] : []))),
      ];
      const reviewed = await this.prisma.review.findMany({
        where: { userId, productId: { in: productIds } },
        select: { productId: true },
      });
      const done = new Set(reviewed.map((r) => r.productId));
      reviewable = productIds.filter((id) => !done.has(id));
    }
    return toOrderDetail(order, this.storage, reviewable);
  }

  async cancelByCustomer(userId: string, orderId: string): Promise<OrderDetailDto> {
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, userId },
      select: { status: true },
    });
    if (!order) throw AppException.notFound('Order');
    if (!CUSTOMER_CANCELLABLE_STATUSES.includes(order.status)) {
      throw AppException.unprocessable(
        'ORDER_NOT_CANCELLABLE',
        'The order can no longer be cancelled',
      );
    }
    await this.status.transition(
      orderId,
      'CANCELLED',
      { userId, kind: 'customer' },
      'Cancelled by customer',
    );
    return this.getForUser(userId, orderId);
  }
}
