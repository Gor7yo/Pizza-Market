import type { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { PricingService } from './pricing.service';

const ids = {
  product: '00000000-0000-7000-8000-000000000001',
  size30: '00000000-0000-7000-8000-000000000002',
  size35: '00000000-0000-7000-8000-000000000003',
  crustClassic: '00000000-0000-7000-8000-000000000004',
  crustCheese: '00000000-0000-7000-8000-000000000005',
  mozzarella: '00000000-0000-7000-8000-000000000006',
  pepperoni: '00000000-0000-7000-8000-000000000007',
  jalapeno: '00000000-0000-7000-8000-000000000008',
  drink: '00000000-0000-7000-8000-000000000009',
};

function ingredient(id: string, extraPrice: number, isAvailable = true) {
  return { id, name: { en: id }, extraPrice, isAvailable, isArchived: false };
}

const pizza = {
  id: ids.product,
  slug: 'pepperoni',
  name: { en: 'Pepperoni' },
  imageKey: null,
  categoryId: 'cat',
  basePrice: 3400,
  isConfigurable: true,
  isAvailable: true,
  isArchived: false,
  category: { isActive: true, isArchived: false },
  sizes: [
    { id: ids.size30, sizeCm: 30, priceModifier: 1000 },
    { id: ids.size35, sizeCm: 35, priceModifier: 2000 },
  ],
  crusts: [
    {
      crust: {
        id: ids.crustClassic,
        name: { en: 'Classic' },
        priceModifier: 0,
        isAvailable: true,
        isArchived: false,
      },
    },
    {
      crust: {
        id: ids.crustCheese,
        name: { en: 'Cheese' },
        priceModifier: 700,
        isAvailable: true,
        isArchived: false,
      },
    },
  ],
  ingredients: [
    {
      ingredientId: ids.mozzarella,
      role: 'DEFAULT',
      isRemovable: false,
      ingredient: ingredient(ids.mozzarella, 400),
    },
    {
      ingredientId: ids.pepperoni,
      role: 'DEFAULT',
      isRemovable: true,
      ingredient: ingredient(ids.pepperoni, 500),
    },
    {
      ingredientId: ids.jalapeno,
      role: 'EXTRA',
      isRemovable: false,
      ingredient: ingredient(ids.jalapeno, 300),
    },
  ],
};

const drink = {
  ...pizza,
  id: ids.drink,
  slug: 'cola',
  basePrice: 600,
  isConfigurable: false,
  sizes: [],
  crusts: [],
  ingredients: [],
};

function service(products: unknown[] = [pizza, drink]) {
  const prisma = {
    product: { findMany: jest.fn().mockResolvedValue(products) },
  } as unknown as PrismaService;
  return new PricingService(prisma);
}

const base = {
  productId: ids.product,
  sizeId: ids.size35,
  crustId: ids.crustCheese,
  removedIngredientIds: [] as string[],
  extraIngredientIds: [ids.jalapeno],
  quantity: 2,
};

describe('PricingService', () => {
  it('computes base + size + crust + extras from the catalog, never from the client', async () => {
    const [line] = await service().resolve([base]);
    // 3400 + 2000 + 700 + 300 = 6400, x2
    expect(line).toMatchObject({ available: true, unitPrice: 6400, lineTotal: 12800 });
  });

  it('prices simple products by base price', async () => {
    const [line] = await service().resolve([
      {
        productId: ids.drink,
        sizeId: null,
        crustId: null,
        removedIngredientIds: [],
        extraIngredientIds: [],
        quantity: 3,
      },
    ]);
    expect(line).toMatchObject({ available: true, unitPrice: 600, lineTotal: 1800 });
  });

  it.each([
    ['unknown size', { sizeId: ids.drink }],
    ['missing crust', { crustId: null }],
    ['removing a non-removable ingredient', { removedIngredientIds: [ids.mozzarella] }],
    ['adding a non-extra ingredient', { extraIngredientIds: [ids.pepperoni] }],
  ])('rejects %s', async (_label, patch) => {
    const [line] = await service().resolve([{ ...base, ...patch }]);
    expect(line).toMatchObject({ available: false, reason: 'INVALID_CONFIGURATION', lineTotal: 0 });
  });

  it('marks archived or unknown products unavailable', async () => {
    const [archived] = await service([{ ...pizza, isArchived: true }]).resolve([base]);
    expect(archived).toMatchObject({ available: false, reason: 'PRODUCT_UNAVAILABLE' });
    const [missing] = await service([]).resolve([base]);
    expect(missing).toMatchObject({
      available: false,
      reason: 'PRODUCT_UNAVAILABLE',
      product: null,
    });
  });

  it('merges identical configurations into one line', async () => {
    const lines = await service().resolve([base, { ...base, quantity: 1 }]);
    expect(lines).toHaveLength(1);
    expect(lines[0]).toMatchObject({ unitPrice: 6400, lineTotal: 19200 });
  });
});
