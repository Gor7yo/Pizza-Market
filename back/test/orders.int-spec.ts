import { randomUUID } from 'node:crypto';
import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';

type TestAgent = ReturnType<typeof request.agent>;
import type { PrismaService } from '../src/infrastructure/prisma/prisma.service';
import type { RedisService } from '../src/infrastructure/redis/redis.service';
import { createTestApp, createVerifiedUser, resetState } from './utils';

describe('Orders (integration)', () => {
  let app: NestExpressApplication;
  let prisma: PrismaService;
  let redis: RedisService;
  let customer: TestAgent;
  let admin: TestAgent;
  let ids: { product: string; size30: string; crust: string; extra: string; drink: string };

  async function login(email: string): Promise<TestAgent> {
    const agent = request.agent(app.getHttpServer());
    await agent.post('/api/v1/auth/login').send({ email, password: 'Secret123' }).expect(200);
    return agent;
  }

  beforeAll(async () => {
    ({ app, prisma, redis } = await createTestApp());
  });

  beforeEach(async () => {
    await resetState(prisma, redis);
    await createVerifiedUser(prisma, 'customer@example.com', 'Secret123');
    await createVerifiedUser(prisma, 'admin@example.com', 'Secret123', 'ADMIN');

    const category = await prisma.category.create({
      data: { slug: 'pizza', name: { en: 'Pizza' } },
    });
    const crust = await prisma.crust.create({
      data: { name: { en: 'Classic' }, priceModifier: 0 },
    });
    const extra = await prisma.ingredient.create({
      data: { name: { en: 'Jalapeño' }, extraPrice: 300 },
    });
    const product = await prisma.product.create({
      data: {
        slug: 'pepperoni',
        name: { en: 'Pepperoni' },
        description: {},
        categoryId: category.id,
        basePrice: 3000,
        isConfigurable: true,
        sizes: { create: [{ sizeCm: 30, priceModifier: 1000, isDefault: true }] },
        crusts: { create: [{ crustId: crust.id }] },
        ingredients: { create: [{ ingredientId: extra.id, role: 'EXTRA', isRemovable: false }] },
      },
      include: { sizes: true },
    });
    const drink = await prisma.product.create({
      data: {
        slug: 'cola',
        name: { en: 'Cola' },
        description: {},
        categoryId: category.id,
        basePrice: 600,
      },
    });
    ids = {
      product: product.id,
      size30: product.sizes[0]!.id,
      crust: crust.id,
      extra: extra.id,
      drink: drink.id,
    };

    customer = await login('customer@example.com');
    admin = await login('admin@example.com');
  });

  afterAll(async () => {
    await app.close();
  });

  function orderBody(overrides: Record<string, unknown> = {}) {
    return {
      items: [
        {
          productId: ids.product,
          sizeId: ids.size30,
          crustId: ids.crust,
          removedIngredientIds: [],
          extraIngredientIds: [ids.extra],
          quantity: 2,
        },
      ],
      fulfillment: 'PICKUP',
      contactName: 'Aram',
      contactPhone: '+37491000000',
      paymentMethod: 'CASH',
      ...overrides,
    };
  }

  it('creates an order with server-side prices and is idempotent', async () => {
    const key = randomUUID();
    const first = await customer
      .post('/api/v1/orders')
      .set('Idempotency-Key', key)
      .send(orderBody())
      .expect(201);
    // (3000 + 1000 + 0 + 300) * 2 = 8600, pickup -> no delivery fee
    expect(first.body).toMatchObject({
      status: 'PENDING',
      subtotal: 8600,
      deliveryFee: 0,
      total: 8600,
    });
    expect(first.body.history).toHaveLength(1);

    const replay = await customer
      .post('/api/v1/orders')
      .set('Idempotency-Key', key)
      .send(orderBody())
      .expect(200);
    expect(replay.body.id).toBe(first.body.id);
    expect(await prisma.order.count()).toBe(1);

    await customer
      .post('/api/v1/orders')
      .set('Idempotency-Key', key)
      .send(orderBody({ comment: 'different' }))
      .expect(409);
  });

  it('ignores any price sent by the client', async () => {
    const body = orderBody();
    (body.items[0] as Record<string, unknown>).unitPrice = 1;
    const res = await customer
      .post('/api/v1/orders')
      .set('Idempotency-Key', randomUUID())
      .send(body)
      .expect(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects orders below the minimum amount and invalid configurations', async () => {
    const small = orderBody({
      items: [
        {
          productId: ids.drink,
          sizeId: null,
          crustId: null,
          removedIngredientIds: [],
          extraIngredientIds: [],
          quantity: 1,
        },
      ],
    });
    const res = await customer
      .post('/api/v1/orders')
      .set('Idempotency-Key', randomUUID())
      .send(small)
      .expect(422);
    expect(res.body.error.code).toBe('MIN_ORDER_AMOUNT');

    const invalid = orderBody({
      items: [
        {
          productId: ids.product,
          sizeId: null,
          crustId: ids.crust,
          removedIngredientIds: [],
          extraIngredientIds: [],
          quantity: 1,
        },
      ],
    });
    const res2 = await customer
      .post('/api/v1/orders')
      .set('Idempotency-Key', randomUUID())
      .send(invalid)
      .expect(422);
    expect(res2.body.error.code).toBe('INVALID_CONFIGURATION');
  });

  it('applies promo codes server-side and enforces per-user limits', async () => {
    await prisma.promoCode.create({
      data: { code: 'TEN', type: 'PERCENT', value: 10, minOrderAmount: 0, perUserLimit: 1 },
    });
    const first = await customer
      .post('/api/v1/orders')
      .set('Idempotency-Key', randomUUID())
      .send(orderBody({ promoCode: 'ten' }))
      .expect(201);
    expect(first.body).toMatchObject({ discount: 860, total: 7740, promoCode: 'TEN' });

    const second = await customer
      .post('/api/v1/orders')
      .set('Idempotency-Key', randomUUID())
      .send(orderBody({ promoCode: 'TEN' }))
      .expect(422);
    expect(second.body.error.code).toBe('PROMO_USAGE_LIMIT');
  });

  it('enforces the status graph and admin authorization', async () => {
    const order = await customer
      .post('/api/v1/orders')
      .set('Idempotency-Key', randomUUID())
      .send(orderBody())
      .expect(201);
    const id = order.body.id as string;

    // customers cannot use admin endpoints
    await customer
      .patch(`/api/v1/admin/orders/${id}/status`)
      .send({ status: 'CONFIRMED' })
      .expect(403);
    // skipping steps is rejected
    const skip = await admin
      .patch(`/api/v1/admin/orders/${id}/status`)
      .send({ status: 'READY' })
      .expect(422);
    expect(skip.body.error.code).toBe('INVALID_STATUS_TRANSITION');

    for (const status of ['CONFIRMED', 'PREPARING', 'READY', 'DELIVERED']) {
      await admin.patch(`/api/v1/admin/orders/${id}/status`).send({ status }).expect(200);
    }
    const detail = await customer.get(`/api/v1/orders/${id}`).expect(200);
    expect(detail.body.status).toBe('DELIVERED');
    expect(detail.body.history.map((h: { toStatus: string }) => h.toStatus)).toEqual([
      'PENDING',
      'CONFIRMED',
      'PREPARING',
      'READY',
      'DELIVERED',
    ]);
    expect(detail.body.payment.status).toBe('SUCCEEDED');
    expect(await prisma.auditLog.count({ where: { action: 'order.status_change' } })).toBe(4);
  });

  it('hides other users orders (IDOR)', async () => {
    const order = await customer
      .post('/api/v1/orders')
      .set('Idempotency-Key', randomUUID())
      .send(orderBody())
      .expect(201);
    await createVerifiedUser(prisma, 'other@example.com', 'Secret123');
    const other = await login('other@example.com');
    await other.get(`/api/v1/orders/${order.body.id as string}`).expect(404);
    await other.post(`/api/v1/orders/${order.body.id as string}/cancel`).expect(404);
  });

  it('runs the mock card payment flow', async () => {
    const order = await customer
      .post('/api/v1/orders')
      .set('Idempotency-Key', randomUUID())
      .send(orderBody({ paymentMethod: 'CARD' }))
      .expect(201);
    const id = order.body.id as string;
    expect(order.body.payment).toMatchObject({ method: 'CARD', status: 'PENDING' });

    // card orders cannot be confirmed before payment succeeds
    await admin
      .patch(`/api/v1/admin/orders/${id}/status`)
      .send({ status: 'CONFIRMED' })
      .expect(422);

    const paid = await customer
      .post(`/api/v1/orders/${id}/payment/mock-confirm`)
      .send({ outcome: 'success' })
      .expect(200);
    expect(paid.body.status).toBe('SUCCEEDED');
    await admin
      .patch(`/api/v1/admin/orders/${id}/status`)
      .send({ status: 'CONFIRMED' })
      .expect(200);
  });
});
