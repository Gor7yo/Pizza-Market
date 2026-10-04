import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import * as argon2 from 'argon2';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/bootstrap';
import { PrismaService } from '../src/infrastructure/prisma/prisma.service';
import { RedisService } from '../src/infrastructure/redis/redis.service';

export async function createTestApp(): Promise<{
  app: NestExpressApplication;
  prisma: PrismaService;
  redis: RedisService;
}> {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  const app = moduleRef.createNestApplication<NestExpressApplication>({ bufferLogs: true });
  configureApp(app);
  await app.init();
  return { app, prisma: app.get(PrismaService), redis: app.get(RedisService) };
}

const TABLES = [
  'AuditLog',
  'Review',
  'PromoCodeUsage',
  'Payment',
  'OrderStatusHistory',
  'OrderItem',
  'Order',
  'CartItem',
  'Cart',
  'Favorite',
  '_PromoProducts',
  '_PromoCategories',
  'PromoCode',
  'ProductIngredient',
  'ProductCrust',
  'ProductSize',
  'Product',
  'Ingredient',
  'Crust',
  'Category',
  'Address',
  'PasswordResetToken',
  'VerificationCode',
  'Session',
  'Account',
  'User',
  'Setting',
];

/** Deterministic tests: every suite starts from empty tables and an empty Redis DB. */
export async function resetState(prisma: PrismaService, redis: RedisService): Promise<void> {
  await prisma.$executeRawUnsafe(
    `TRUNCATE ${TABLES.map((t) => `"${t}"`).join(', ')} RESTART IDENTITY CASCADE`,
  );
  await redis.client.flushdb();
}

export async function createVerifiedUser(
  prisma: PrismaService,
  email: string,
  password: string,
  role: 'USER' | 'ADMIN' = 'USER',
) {
  return prisma.user.create({
    data: {
      email,
      passwordHash: await argon2.hash(password, { type: argon2.argon2id }),
      emailVerifiedAt: new Date(),
      firstName: 'Test',
      role,
    },
  });
}

export async function waitFor<T>(fn: () => Promise<T | undefined>, timeoutMs = 8_000): Promise<T> {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const value = await fn();
    if (value !== undefined) return value;
    await new Promise((r) => setTimeout(r, 150));
  }
  throw new Error('waitFor timed out');
}
