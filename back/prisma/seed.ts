/* Development seed. Run: pnpm db:seed   (SEED_RESET=true wipes existing data first)
 * Credentials are DEVELOPMENT ONLY and documented in README.md. */
import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import * as argon2 from 'argon2';
import {
  buildSearchText,
  calculateLineTotal,
  calculateUnitPrice,
  type LocalizedText,
  type OrderStatus,
} from '@market/shared';
import {
  type Crust,
  type Prisma,
  type Product,
  PrismaClient,
  type ProductTag,
} from '../src/generated/prisma/client';

type PizzaRow = Prisma.ProductGetPayload<{ include: { sizes: true } }>;

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL ?? '' }),
});

const ADMIN_EMAIL = 'admin@tonir.local';
const ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD ?? 'Admin12345';
const USER_EMAIL = 'user@tonir.local';
const USER_PASSWORD = process.env.SEED_USER_PASSWORD ?? 'User12345';

const img = (id: string) => `https://images.unsplash.com/${id}?auto=format&fit=crop&w=1000&q=80`;

// CC0 photos from Wikimedia Commons (Armenian dishes are rare on stock sites)
const GATA_IMAGE =
  'https://thumb.wikimedia.org/wikipedia/commons/thumb/3/3e/Gata_%28p%C3%A2tisserie%29.jpg/960px-Gata_%28p%C3%A2tisserie%29.jpg';
const TAN_IMAGE =
  'https://thumb.wikimedia.org/wikipedia/commons/thumb/e/ee/Carousel_Restaurant_Hollywood_July_2022_Tan.JPG/960px-Carousel_Restaurant_Hollywood_July_2022_Tan.JPG';

type T = Required<LocalizedText>;
const t = (ru: string, en: string, hy: string): T => ({ ru, en, hy });

const INGREDIENTS = {
  mozzarella: { name: t('Моцарелла', 'Mozzarella', 'Մոցարելլա'), price: 400 },
  pepperoni: { name: t('Пепперони', 'Pepperoni', 'Պեպերոնի'), price: 500 },
  ham: { name: t('Ветчина', 'Ham', 'Խոզապուխտ'), price: 450 },
  mushrooms: { name: t('Шампиньоны', 'Mushrooms', 'Սունկ'), price: 300 },
  jalapeno: { name: t('Халапеньо', 'Jalapeño', 'Խալապենյո'), price: 300 },
  olives: { name: t('Маслины', 'Olives', 'Ձիթապտուղ'), price: 300 },
  tomatoes: { name: t('Томаты', 'Tomatoes', 'Լոլիկ'), price: 250 },
  onion: { name: t('Красный лук', 'Red onion', 'Կարմիր սոխ'), price: 200 },
  chicken: { name: t('Курица', 'Chicken', 'Հավ'), price: 500 },
  bacon: { name: t('Бекон', 'Bacon', 'Բեկոն'), price: 500 },
  pineapple: { name: t('Ананас', 'Pineapple', 'Արքայախնձոր'), price: 350 },
  pepper: { name: t('Сладкий перец', 'Bell pepper', 'Բուլղարական պղպեղ'), price: 250 },
  parmesan: { name: t('Пармезан', 'Parmesan', 'Պարմեզան'), price: 450 },
  basil: { name: t('Базилик', 'Basil', 'Ռեհան'), price: 150 },
  bbq: { name: t('Соус барбекю', 'BBQ sauce', 'Բարբեքյու սոուս'), price: 200 },
  suluguni: { name: t('Сулугуни', 'Suluguni cheese', 'Սուլուգունի'), price: 400 },
  greens: { name: t('Зелень', 'Fresh herbs', 'Կանաչի'), price: 150 },
  basturma: { name: t('Бастурма', 'Basturma', 'Բաստուրմա'), price: 600 },
  sujukh: { name: t('Суджук', 'Sujukh', 'Սուջուխ'), price: 550 },
} as const;
type IngredientKey = keyof typeof INGREDIENTS;

interface PizzaSeed {
  slug: string;
  name: T;
  description: T;
  basePrice: number;
  image: string;
  tags: ProductTag[];
  defaults: IngredientKey[];
  extras: IngredientKey[];
}

const PIZZAS: PizzaSeed[] = [
  {
    slug: 'margherita',
    name: t('Маргарита', 'Margherita', 'Մարգարիտա'),
    description: t(
      'Томатный соус, моцарелла, свежие томаты и базилик',
      'Tomato sauce, mozzarella, fresh tomatoes and basil',
      'Լոլիկի սոուս, մոցարելլա, թարմ լոլիկ և ռեհան',
    ),

    basePrice: 2900,
    image: img('photo-1574071318508-1cdbab80d002'),
    tags: ['VEGETARIAN'],
    defaults: ['mozzarella', 'tomatoes', 'basil'],
    extras: ['mozzarella', 'parmesan', 'olives', 'mushrooms'],
  },
  {
    slug: 'pepperoni',
    name: t('Пепперони', 'Pepperoni', 'Պեպերոնի'),
    description: t(
      'Много пепперони и тянущаяся моцарелла на томатном соусе',
      'Loads of pepperoni and stretchy mozzarella on tomato sauce',
      'Առատ պեպերոնի և մոցարելլա լոլիկի սոուսի վրա',
    ),
    basePrice: 3400,
    image: img('photo-1628840042765-356cda07504e'),
    tags: ['HIT'],
    defaults: ['mozzarella', 'pepperoni'],
    extras: ['jalapeno', 'mozzarella', 'mushrooms', 'olives'],
  },
  {
    slug: 'four-cheese',
    name: t('Четыре сыра', 'Four cheese', 'Չորս պանիր'),
    description: t(
      'Моцарелла, сулугуни, пармезан и сливочный соус',
      'Mozzarella, suluguni, parmesan and cream sauce',
      'Մոցարելլա, սուլուգունի, պարմեզան և սերուցքային սոուս',
    ),
    basePrice: 3800,
    image: img('photo-1513104890138-7c749659a591'),
    tags: ['VEGETARIAN'],
    defaults: ['mozzarella', 'suluguni', 'parmesan'],
    extras: ['basil', 'tomatoes', 'mushrooms'],
  },
  {
    slug: 'bbq-chicken',
    name: t('Барбекю с курицей', 'BBQ chicken', 'Բարբեքյու հավով'),
    description: t(
      'Курица, бекон, красный лук, моцарелла и соус барбекю',
      'Chicken, bacon, red onion, mozzarella and BBQ sauce',
      'Հավ, բեկոն, կարմիր սոխ, մոցարելլա և բարբեքյու սոուս',
    ),
    basePrice: 3700,
    image: img('photo-1565299624946-b28f40a0ae38'),
    tags: ['HIT'],
    defaults: ['chicken', 'bacon', 'onion', 'bbq', 'mozzarella'],
    extras: ['jalapeno', 'mushrooms', 'mozzarella'],
  },
  {
    slug: 'hawaiian',
    name: t('Гавайская', 'Hawaiian', 'Հավայական'),
    description: t(
      'Ветчина, ананас и моцарелла на томатном соусе',
      'Ham, pineapple and mozzarella on tomato sauce',
      'Խոզապուխտ, արքայախնձոր և մոցարելլա',
    ),
    basePrice: 3400,
    image: img('photo-1588315029754-2dd089d39a1a'),
    tags: [],
    defaults: ['ham', 'pineapple', 'mozzarella'],
    extras: ['bacon', 'jalapeno', 'mozzarella'],
  },
  {
    slug: 'ham-mushrooms',
    name: t('Ветчина и грибы', 'Ham & mushrooms', 'Խոզապուխտ և սունկ'),
    description: t(
      'Ветчина, шампиньоны, моцарелла и томатный соус',
      'Ham, mushrooms, mozzarella and tomato sauce',
      'Խոզապուխտ, սունկ, մոցարելլա և լոլիկի սոուս',
    ),
    basePrice: 3300,
    image: img('photo-1590947132387-155cc02f3212'),
    tags: [],
    defaults: ['ham', 'mushrooms', 'mozzarella'],
    extras: ['olives', 'onion', 'mozzarella'],
  },
  {
    slug: 'spicy-mexican',
    name: t('Острая мексиканская', 'Spicy Mexican', 'Կծու մեքսիկական'),
    description: t(
      'Пепперони, халапеньо, сладкий перец и красный лук',
      'Pepperoni, jalapeño, bell pepper and red onion',
      'Պեպերոնի, խալապենյո, բուլղարական պղպեղ և կարմիր սոխ',
    ),
    basePrice: 3600,
    image: img('photo-1604382354936-07c5d9983bd3'),
    tags: ['SPICY'],
    defaults: ['pepperoni', 'jalapeno', 'pepper', 'onion', 'mozzarella'],
    extras: ['jalapeno', 'bacon', 'mozzarella'],
  },
  {
    slug: 'veggie',
    name: t('Вегетарианская', 'Veggie', 'Բուսական'),
    description: t(
      'Грибы, сладкий перец, томаты, маслины и красный лук',
      'Mushrooms, bell pepper, tomatoes, olives and red onion',
      'Սունկ, պղպեղ, լոլիկ, ձիթապտուղ և կարմիր սոխ',
    ),
    basePrice: 3200,
    image: img('photo-1593560708920-61dd98c46a4e'),
    tags: ['VEGETARIAN'],
    defaults: ['mushrooms', 'pepper', 'tomatoes', 'olives', 'onion', 'mozzarella'],
    extras: ['parmesan', 'basil', 'jalapeno'],
  },
  {
    slug: 'yerevan-basturma',
    name: t('Ереванская с бастурмой', 'Yerevan basturma', 'Երևանյան բաստուրմայով'),
    description: t(
      'Бастурма, сулугуни, томаты и свежая зелень',
      'Basturma, suluguni cheese, tomatoes and fresh herbs',
      'Բաստուրմա, սուլուգունի, լոլիկ և թարմ կանաչի',
    ),
    basePrice: 3900,
    image: img('photo-1594007654729-407eedc4be65'),
    tags: ['NEW', 'HIT'],
    defaults: ['basturma', 'suluguni', 'tomatoes', 'greens'],
    extras: ['basturma', 'suluguni', 'jalapeno'],
  },
  {
    slug: 'sujukh',
    name: t('Суджук', 'Sujukh', 'Սուջուխ'),
    description: t(
      'Пряный суджук, моцарелла, сладкий перец и лук',
      'Spiced sujukh sausage, mozzarella, bell pepper and onion',
      'Համեմված սուջուխ, մոցարելլա, պղպեղ և սոխ',
    ),
    basePrice: 3800,
    image: img('photo-1534308983496-4fabb1a015ee'),
    tags: ['NEW', 'SPICY'],
    defaults: ['sujukh', 'mozzarella', 'pepper', 'onion'],
    extras: ['sujukh', 'jalapeno', 'mozzarella'],
  },
];

interface SimpleSeed {
  slug: string;
  category: 'snacks' | 'drinks' | 'desserts';
  name: T;
  description: T;
  price: number;
  image: string;
  tags?: ProductTag[];
}

const SIMPLE_PRODUCTS: SimpleSeed[] = [
  {
    slug: 'fries',
    category: 'snacks',
    name: t('Картофель фри', 'French fries', 'Ֆրի'),
    description: t(
      'Хрустящий картофель с соусом',
      'Crispy fries with a dip',
      'Խրթխրթան կարտոֆիլ սոուսով',
    ),
    price: 1200,
    image: img('photo-1630384060421-cb20d0e0649d'),
  },
  {
    slug: 'chicken-wings',
    category: 'snacks',
    name: t('Куриные крылья', 'Chicken wings', 'Հավի թևիկներ'),
    description: t('8 крыльев в соусе барбекю', '8 wings in BBQ sauce', '8 թևիկ բարբեքյու սոուսով'),
    price: 2400,
    image: img('photo-1608039755401-742074f0548d'),
    tags: ['HIT'],
  },
  {
    slug: 'garlic-bread',
    category: 'snacks',
    name: t('Чесночный хлеб', 'Garlic bread', 'Սխտորով հաց'),
    description: t(
      'Из печи, с маслом и зеленью',
      'Oven-baked with butter and herbs',
      'Վառարանից, կարագով և կանաչիով',
    ),
    price: 1100,
    image: img('photo-1619535860434-ba1d8fa12536'),
  },
  {
    slug: 'cola',
    category: 'drinks',
    name: t('Кола 0,5 л', 'Cola 0.5 L', 'Կոլա 0,5 լ'),
    description: t('Охлаждённая', 'Chilled', 'Սառը'),
    price: 600,
    image: img('photo-1581636625402-29b2a704ef13'),
  },
  {
    slug: 'jermuk',
    category: 'drinks',
    name: t('Джермук 0,5 л', 'Jermuk 0.5 L', 'Ջերմուկ 0,5 լ'),
    description: t('Минеральная вода', 'Mineral water', 'Հանքային ջուր'),
    price: 400,
    image: img('photo-1523362628745-0c100150b504'),
  },
  {
    slug: 'tan',
    category: 'drinks',
    name: t('Тан 0,5 л', 'Tan 0.5 L', 'Թան 0,5 լ'),
    description: t(
      'Освежающий кисломолочный напиток',
      'Refreshing yogurt drink',
      'Թարմացնող թթվակաթնային ըմպելիք',
    ),
    price: 500,
    image: TAN_IMAGE,
    tags: ['NEW'],
  },
  {
    slug: 'cheesecake',
    category: 'desserts',
    name: t('Чизкейк', 'Cheesecake', 'Չիզքեյք'),
    description: t(
      'Нежный сливочный десерт',
      'Creamy classic cheesecake',
      'Նուրբ սերուցքային աղանդեր',
    ),
    price: 1500,
    image: img('photo-1533134242443-d4fd215305ad'),
  },
  {
    slug: 'gata',
    category: 'desserts',
    name: t('Гата', 'Gata', 'Գաթա'),
    description: t(
      'Традиционная армянская сладкая выпечка',
      'Traditional Armenian sweet bread',
      'Ավանդական հայկական գաթա',
    ),
    price: 1200,
    image: GATA_IMAGE,
    tags: ['HIT'],
  },
];

const SIZES = [
  { sizeCm: 25, weightGrams: 450, priceModifier: 0, isDefault: false },
  { sizeCm: 30, weightGrams: 620, priceModifier: 1000, isDefault: true },
  { sizeCm: 35, weightGrams: 850, priceModifier: 2000, isDefault: false },
];

async function reset(): Promise<void> {
  const tables = [
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
  await prisma.$executeRawUnsafe(
    `TRUNCATE ${tables.map((x) => `"${x}"`).join(', ')} RESTART IDENTITY CASCADE`,
  );
}

/**
 * Non-destructive refresh of seed product photos in an existing database.
 * Only products whose image is empty or still a stock/seed URL are touched,
 * so photos uploaded through the admin panel are preserved.
 */
async function syncCatalogImages(): Promise<void> {
  const images = new Map<string, string>([
    ...PIZZAS.map((p) => [p.slug, p.image] as const),
    ...SIMPLE_PRODUCTS.map((p) => [p.slug, p.image] as const),
  ]);
  let updated = 0;
  for (const [slug, image] of images) {
    const { count } = await prisma.product.updateMany({
      where: {
        slug,
        OR: [
          { imageKey: null },
          { imageKey: { startsWith: 'https://images.unsplash.com/' } },
          { imageKey: { startsWith: 'https://thumb.wikimedia.org/' } },
        ],
      },
      data: { imageKey: image },
    });
    updated += count;
  }
  console.warn(`Product images refreshed: ${updated}`);
}

async function main(): Promise<void> {
  if (process.env.SEED_RESET === 'true') {
    console.warn('SEED_RESET=true -> wiping all data');
    await reset();
  } else if ((await prisma.user.count()) > 0) {
    console.warn(
      'Database already contains data - only refreshing product photos. Run with SEED_RESET=true to re-seed everything.',
    );
    await syncCatalogImages();
    return;
  }

  const hashOptions: argon2.HashOptions = {
    type: argon2.argon2id,
    memoryCost: 19_456,
    timeCost: 2,
    parallelism: 1,
  };
  const now = Date.now();
  const daysAgo = (d: number) => new Date(now - d * 24 * 3600 * 1000);

  // users
  const admin = await prisma.user.create({
    data: {
      email: ADMIN_EMAIL,
      passwordHash: await argon2.hash(ADMIN_PASSWORD, hashOptions),
      emailVerifiedAt: new Date(),
      firstName: 'Admin',
      lastName: 'Tonir',
      role: 'ADMIN',
    },
  });
  const user = await prisma.user.create({
    data: {
      email: USER_EMAIL,
      passwordHash: await argon2.hash(USER_PASSWORD, hashOptions),
      emailVerifiedAt: new Date(),
      firstName: 'Aram',
      lastName: 'Petrosyan',
      phone: '+37491000000',
      createdAt: daysAgo(40),
      addresses: {
        create: {
          label: 'Дом',
          country: 'AM',
          city: 'Yerevan',
          street: 'Tumanyan St. 5',
          apartment: '12',
          entrance: '2',
          floor: '4',
          intercom: '12',
          latitude: 40.1826,
          longitude: 44.5147,
          isDefault: true,
        },
      },
    },
    include: { addresses: true },
  });
  const anna = await prisma.user.create({
    data: {
      email: 'anna@tonir.local',
      passwordHash: await argon2.hash(USER_PASSWORD, hashOptions),
      emailVerifiedAt: new Date(),
      firstName: 'Anna',
      lastName: 'Sargsyan',
      createdAt: daysAgo(10),
    },
  });

  // catalog
  const categories = {
    pizza: await prisma.category.create({
      data: { slug: 'pizza', name: t('Пиццы', 'Pizza', 'Պիցցաներ'), sortOrder: 0 },
    }),
    snacks: await prisma.category.create({
      data: { slug: 'snacks', name: t('Закуски', 'Snacks', 'Խորտիկներ'), sortOrder: 1 },
    }),
    drinks: await prisma.category.create({
      data: { slug: 'drinks', name: t('Напитки', 'Drinks', 'Ըմպելիքներ'), sortOrder: 2 },
    }),
    desserts: await prisma.category.create({
      data: { slug: 'desserts', name: t('Десерты', 'Desserts', 'Աղանդեր'), sortOrder: 3 },
    }),
  };

  const crusts = await Promise.all([
    prisma.crust.create({
      data: { name: t('Классический', 'Classic', 'Դասական'), priceModifier: 0, sortOrder: 0 },
    }),
    prisma.crust.create({
      data: { name: t('Тонкий', 'Thin', 'Բարակ'), priceModifier: 0, sortOrder: 1 },
    }),
    prisma.crust.create({
      data: {
        name: t('Сырный борт', 'Cheese crust', 'Պանրային եզր'),
        priceModifier: 700,
        sortOrder: 2,
      },
    }),
  ]);

  const ingredientIds = {} as Record<IngredientKey, string>;
  for (const [key, value] of Object.entries(INGREDIENTS) as [
    IngredientKey,
    (typeof INGREDIENTS)[IngredientKey],
  ][]) {
    const row = await prisma.ingredient.create({
      data: { name: value.name, extraPrice: value.price },
    });
    ingredientIds[key] = row.id;
  }

  const pizzaProducts: PizzaRow[] = [];
  for (const [index, p] of PIZZAS.entries()) {
    const product = await prisma.product.create({
      data: {
        slug: p.slug,
        name: p.name,
        description: p.description,
        searchText: buildSearchText(p.name, p.description),
        categoryId: categories.pizza.id,
        basePrice: p.basePrice,
        isConfigurable: true,
        tags: p.tags,
        sortOrder: index,
        imageKey: p.image,
        createdAt: daysAgo(p.tags.includes('NEW') ? 3 : 60 - index),
        sizes: { create: SIZES },
        crusts: { create: crusts.map((c) => ({ crustId: c.id })) },
        ingredients: {
          create: [
            ...p.defaults.map((k, i) => ({
              ingredientId: ingredientIds[k],
              role: 'DEFAULT' as const,
              isRemovable: true,
              sortOrder: i,
            })),
            ...p.extras
              .filter((k) => !p.defaults.includes(k))
              .map((k, i) => ({
                ingredientId: ingredientIds[k],
                role: 'EXTRA' as const,
                isRemovable: false,
                sortOrder: i,
              })),
          ],
        },
      },
      include: { sizes: true },
    });
    pizzaProducts.push(product);
  }

  const simpleProducts: Product[] = [];
  for (const [index, p] of SIMPLE_PRODUCTS.entries()) {
    simpleProducts.push(
      await prisma.product.create({
        data: {
          slug: p.slug,
          name: p.name,
          description: p.description,
          searchText: buildSearchText(p.name, p.description),
          categoryId: categories[p.category].id,
          basePrice: p.price,
          isConfigurable: false,
          tags: p.tags ?? [],
          sortOrder: index,
          imageKey: p.image,
        },
      }),
    );
  }

  // promo codes
  await prisma.promoCode.createMany({
    data: [
      {
        code: 'WELCOME10',
        description: '−10% на первый заказ',
        type: 'PERCENT',
        value: 10,
        maxDiscount: 3000,
        minOrderAmount: 3000,
        perUserLimit: 1,
      },
      {
        code: 'PIZZA1000',
        description: '−1000 ֏ от 6000 ֏',
        type: 'FIXED',
        value: 1000,
        minOrderAmount: 6000,
        usageLimit: 500,
      },
      {
        code: 'SUMMER2025',
        description: 'Expired example',
        type: 'PERCENT',
        value: 20,
        expiresAt: daysAgo(30),
        isActive: true,
      },
    ],
  });
  await prisma.promoCode.create({
    data: {
      code: 'PIZZALOVER',
      description: '−15% на пиццы',
      type: 'PERCENT',
      value: 15,
      minOrderAmount: 0,
      categories: { connect: { id: categories.pizza.id } },
    },
  });

  await prisma.setting.create({
    data: {
      key: 'store',
      value: {
        data: {
          isAcceptingOrders: true,
          deliveryFee: 800,
          freeDeliveryThreshold: 10000,
          minOrderAmount: 3000,
          pickupAddress: 'Yerevan, Abovyan St. 10',
          supportPhone: '+374 10 000000',
          exchangeRates: { USD: '0.0026', RUB: '0.21' },
        },
        ratesUpdatedAt: new Date().toISOString(),
      },
    },
  });

  // sample orders (prices computed with the same shared pricing functions as the API)
  const classic = crusts[0]!;
  const cheese = crusts[2]!;
  const address = user.addresses[0]!;
  const addressSnapshot = {
    country: address.country,
    city: address.city,
    street: address.street,
    apartment: address.apartment,
    entrance: address.entrance,
    floor: address.floor,
    intercom: address.intercom,
    instructions: address.instructions,
    latitude: address.latitude,
    longitude: address.longitude,
  };

  const fullPath: OrderStatus[] = [
    'PENDING',
    'CONFIRMED',
    'PREPARING',
    'READY',
    'OUT_FOR_DELIVERY',
    'DELIVERED',
  ];

  async function createOrder(params: {
    userId: string;
    daysBack: number;
    status: OrderStatus;
    path: OrderStatus[];
    lines: { product: PizzaRow; sizeCm: number; crust: Crust; quantity: number }[];
    extras?: { product: Product; quantity: number }[];
  }) {
    const created = daysAgo(params.daysBack);
    const items = [
      ...params.lines.map((l) => {
        const size = l.product.sizes.find((s) => s.sizeCm === l.sizeCm)!;
        const unitPrice = calculateUnitPrice({
          basePrice: l.product.basePrice,
          sizeModifier: size.priceModifier,
          crustModifier: l.crust.priceModifier,
          extraPrices: [],
        });
        return {
          productId: l.product.id,
          productSlug: l.product.slug,
          name: l.product.name as T,
          imageKey: l.product.imageKey,
          sizeId: size.id,
          sizeCm: size.sizeCm,
          crustId: l.crust.id,
          crustName: l.crust.name as T,
          removedIngredients: [],
          extraIngredients: [],
          configuration: {
            productId: l.product.id,
            sizeId: size.id,
            crustId: l.crust.id,
            removedIngredientIds: [],
            extraIngredientIds: [],
            quantity: l.quantity,
          },
          basePrice: l.product.basePrice,
          sizeModifier: size.priceModifier,
          crustModifier: l.crust.priceModifier,
          unitPrice,
          quantity: l.quantity,
          lineTotal: calculateLineTotal(unitPrice, l.quantity),
        };
      }),
      ...(params.extras ?? []).map((e) => ({
        productId: e.product.id,
        productSlug: e.product.slug,
        name: e.product.name as T,
        imageKey: e.product.imageKey,
        removedIngredients: [],
        extraIngredients: [],
        configuration: {
          productId: e.product.id,
          sizeId: null,
          crustId: null,
          removedIngredientIds: [],
          extraIngredientIds: [],
          quantity: e.quantity,
        },
        basePrice: e.product.basePrice,
        unitPrice: e.product.basePrice,
        quantity: e.quantity,
        lineTotal: calculateLineTotal(e.product.basePrice, e.quantity),
      })),
    ];
    const subtotal = items.reduce((s, i) => s + i.lineTotal, 0);
    const deliveryFee = subtotal >= 10000 ? 0 : 800;
    const total = subtotal + deliveryFee;
    const history = params.path.map((status, i) => ({
      fromStatus: i === 0 ? null : params.path[i - 1]!,
      toStatus: status,
      note: i === 0 ? 'Order created' : null,
      changedById: i === 0 ? params.userId : admin.id,
      createdAt: new Date(created.getTime() + i * 12 * 60_000),
    }));

    return prisma.order.create({
      data: {
        userId: params.userId,
        status: params.status,
        fulfillment: 'DELIVERY',
        currency: 'AMD',
        subtotal,
        discount: 0,
        deliveryFee,
        total,
        contactName: 'Aram Petrosyan',
        contactPhone: '+37491000000',
        address: addressSnapshot,
        idempotencyKey: crypto.randomUUID(),
        requestHash: 'seed',
        createdAt: created,
        items: { create: items },
        history: { create: history },
        payment: {
          create: {
            provider: 'offline',
            method: 'CASH',
            status:
              params.status === 'DELIVERED'
                ? 'SUCCEEDED'
                : params.status === 'CANCELLED'
                  ? 'CANCELLED'
                  : 'PENDING',
            amount: total,
            currency: 'AMD',
          },
        },
      },
    });
  }

  const [margherita, pepperoni, , bbq, , , , , basturma] = pizzaProducts;
  const [fries, wings, , cola] = simpleProducts;

  await createOrder({
    userId: user.id,
    daysBack: 12,
    status: 'DELIVERED',
    path: fullPath,
    lines: [
      { product: pepperoni!, sizeCm: 30, crust: classic, quantity: 1 },
      { product: margherita!, sizeCm: 25, crust: classic, quantity: 1 },
    ],
    extras: [{ product: cola!, quantity: 2 }],
  });
  await createOrder({
    userId: anna.id,
    daysBack: 6,
    status: 'DELIVERED',
    path: fullPath,
    lines: [{ product: basturma!, sizeCm: 35, crust: cheese, quantity: 1 }],
    extras: [{ product: wings!, quantity: 1 }],
  });
  await createOrder({
    userId: user.id,
    daysBack: 3,
    status: 'CANCELLED',
    path: ['PENDING', 'CANCELLED'],
    lines: [{ product: bbq!, sizeCm: 30, crust: classic, quantity: 1 }],
  });
  await createOrder({
    userId: user.id,
    daysBack: 0,
    status: 'PREPARING',
    path: ['PENDING', 'CONFIRMED', 'PREPARING'],
    lines: [{ product: basturma!, sizeCm: 30, crust: classic, quantity: 2 }],
    extras: [{ product: fries!, quantity: 1 }],
  });

  // popularity from non-cancelled orders
  const sold = await prisma.orderItem.groupBy({
    by: ['productId'],
    where: { productId: { not: null }, order: { status: { not: 'CANCELLED' } } },
    _sum: { quantity: true },
  });
  for (const s of sold) {
    if (s.productId)
      await prisma.product.update({
        where: { id: s.productId },
        data: { soldCount: s._sum.quantity ?? 0 },
      });
  }

  // reviews from customers with delivered orders
  await prisma.review.createMany({
    data: [
      {
        productId: pepperoni!.id,
        userId: user.id,
        rating: 5,
        comment: 'Отличная пепперони, тесто супер!',
        status: 'APPROVED',
      },
      {
        productId: margherita!.id,
        userId: user.id,
        rating: 4,
        comment: 'Классика, всё как надо.',
        status: 'APPROVED',
      },
      {
        productId: basturma!.id,
        userId: anna.id,
        rating: 5,
        comment: 'Բաստուրմայով պիցցան հրաշալի է։',
        status: 'APPROVED',
      },
      {
        productId: wings!.id,
        userId: anna.id,
        rating: 3,
        comment: 'Хотелось бы поострее.',
        status: 'PENDING',
      },
    ],
  });
  for (const productId of [pepperoni!.id, margherita!.id, basturma!.id]) {
    const agg = await prisma.review.aggregate({
      where: { productId, status: 'APPROVED' },
      _avg: { rating: true },
      _count: { _all: true },
    });
    await prisma.product.update({
      where: { id: productId },
      data: { ratingAvg: agg._avg.rating, ratingCount: agg._count._all },
    });
  }

  await prisma.favorite.create({ data: { userId: user.id, productId: basturma!.id } });

  console.warn(`Seed complete.
  admin: ${ADMIN_EMAIL} / ${ADMIN_PASSWORD}
  user:  ${USER_EMAIL} / ${USER_PASSWORD}`);
}

main()
  .catch((err: unknown) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => void prisma.$disconnect());
