/**
 * Response contracts of the REST API (`/api/v1`). Both apps import these,
 * so the web app never guesses response shapes.
 * Dates are ISO strings, money is integer minor units of `currency`.
 */
import type { Locale, LocalizedText } from './locale';
import type { Currency, ExchangeRates } from './money';
import type { FulfillmentType, OrderStatus, PaymentMethod, PaymentStatus } from './order-status';
import type { PromoType } from './pricing';
import type { IngredientRole, ProductTag } from './schemas/catalog';
import type { ReviewStatus, UserRole } from './schemas/admin';
import type { ErrorCode } from './errors';

export interface Paginated<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

/* ---------- auth / users ---------- */

export interface UserDto {
  id: string;
  email: string;
  emailVerified: boolean;
  firstName: string;
  lastName: string | null;
  phone: string | null;
  avatarUrl: string | null;
  role: UserRole;
  locale: Locale;
  preferredCurrency: Currency;
  hasPassword: boolean;
  linkedProviders: string[];
  createdAt: string;
}

export interface AuthResultDto {
  user: UserDto;
}

export interface RegisterResultDto {
  email: string;
  /** Verification code is valid for this many seconds */
  codeTtlSeconds: number;
}

export interface SessionDto {
  id: string;
  userAgent: string | null;
  ip: string | null;
  createdAt: string;
  lastUsedAt: string;
  current: boolean;
}

export interface AddressDto {
  id: string;
  label: string | null;
  country: string;
  city: string;
  street: string;
  apartment: string | null;
  entrance: string | null;
  floor: string | null;
  intercom: string | null;
  instructions: string | null;
  latitude: number | null;
  longitude: number | null;
  isDefault: boolean;
}

/* ---------- catalog ---------- */

export interface CategoryDto {
  id: string;
  slug: string;
  name: LocalizedText;
  sortOrder: number;
  productCount: number;
}

export interface ProductCardDto {
  id: string;
  slug: string;
  name: LocalizedText;
  description: LocalizedText;
  imageUrl: string | null;
  categoryId: string;
  categorySlug: string;
  /** Lowest possible price (base + cheapest size + cheapest allowed crust) */
  fromPrice: number;
  isConfigurable: boolean;
  isAvailable: boolean;
  tags: ProductTag[];
  ratingAvg: number | null;
  ratingCount: number;
}

export interface ProductSizeDto {
  id: string;
  sizeCm: number;
  weightGrams: number | null;
  priceModifier: number;
  isDefault: boolean;
}

export interface CrustDto {
  id: string;
  name: LocalizedText;
  priceModifier: number;
  isAvailable: boolean;
  sortOrder: number;
}

export interface IngredientDto {
  id: string;
  name: LocalizedText;
  imageUrl: string | null;
  extraPrice: number;
  isAvailable: boolean;
}

export interface ProductIngredientDto {
  ingredient: IngredientDto;
  role: IngredientRole;
  isRemovable: boolean;
}

export interface ProductDetailDto extends ProductCardDto {
  basePrice: number;
  sizes: ProductSizeDto[];
  crusts: CrustDto[];
  ingredients: ProductIngredientDto[];
  category: { id: string; slug: string; name: LocalizedText };
}

export interface CatalogMetaDto {
  currency: Currency;
  exchangeRates: ExchangeRates;
}

/* ---------- cart / pricing ---------- */

export interface PricedCartLineDto {
  key: string;
  productId: string;
  productSlug: string;
  name: LocalizedText;
  imageUrl: string | null;
  sizeId: string | null;
  sizeCm: number | null;
  crustId: string | null;
  crustName: LocalizedText | null;
  removedIngredients: { id: string; name: LocalizedText }[];
  extraIngredients: { id: string; name: LocalizedText; price: number }[];
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  /** false when the product/options became unavailable: line is excluded from totals */
  available: boolean;
  unavailableReason: ErrorCode | null;
}

export interface PromoResultDto {
  code: string;
  applied: boolean;
  discount: number;
  errorCode: ErrorCode | null;
  description: string | null;
}

export interface CartQuoteDto {
  currency: Currency;
  lines: PricedCartLineDto[];
  subtotal: number;
  discount: number;
  deliveryFee: number;
  total: number;
  promo: PromoResultDto | null;
  minOrderAmount: number;
  freeDeliveryThreshold: number | null;
  isAcceptingOrders: boolean;
}

export interface ServerCartItemDto {
  productId: string;
  sizeId: string | null;
  crustId: string | null;
  removedIngredientIds: string[];
  extraIngredientIds: string[];
  quantity: number;
}

export interface ServerCartDto {
  items: ServerCartItemDto[];
  updatedAt: string | null;
}

/* ---------- orders ---------- */

export interface OrderItemDto {
  id: string;
  productId: string | null;
  productSlug: string | null;
  name: LocalizedText;
  imageUrl: string | null;
  sizeCm: number | null;
  crustName: LocalizedText | null;
  removedIngredients: { id: string; name: LocalizedText }[];
  extraIngredients: { id: string; name: LocalizedText; price: number }[];
  /** Original configuration, used for "repeat order" */
  configuration: ServerCartItemDto;
  unitPrice: number;
  quantity: number;
  lineTotal: number;
}

export interface OrderStatusHistoryDto {
  id: string;
  fromStatus: OrderStatus | null;
  toStatus: OrderStatus;
  note: string | null;
  createdAt: string;
}

export interface PaymentDto {
  id: string;
  provider: string;
  method: PaymentMethod;
  status: PaymentStatus;
  amount: number;
  currency: Currency;
  redirectUrl: string | null;
  failureReason: string | null;
  updatedAt: string;
}

export interface OrderAddressDto {
  country: string;
  city: string;
  street: string;
  apartment: string | null;
  entrance: string | null;
  floor: string | null;
  intercom: string | null;
  instructions: string | null;
  latitude: number | null;
  longitude: number | null;
}

export interface OrderSummaryDto {
  id: string;
  number: number;
  status: OrderStatus;
  fulfillment: FulfillmentType;
  total: number;
  currency: Currency;
  itemCount: number;
  paymentStatus: PaymentStatus | null;
  createdAt: string;
}

export interface OrderDetailDto extends OrderSummaryDto {
  subtotal: number;
  discount: number;
  deliveryFee: number;
  promoCode: string | null;
  contactName: string;
  contactPhone: string;
  comment: string | null;
  address: OrderAddressDto | null;
  items: OrderItemDto[];
  history: OrderStatusHistoryDto[];
  payment: PaymentDto | null;
  canCancel: boolean;
  /** Product ids of this order the user may still review */
  reviewableProductIds: string[];
}

export interface AdminOrderSummaryDto extends OrderSummaryDto {
  customer: { id: string; email: string; name: string } | null;
  contactPhone: string;
}

export interface AdminOrderDetailDto extends OrderDetailDto {
  customer: { id: string; email: string; name: string } | null;
  allowedTransitions: OrderStatus[];
}

/* ---------- reviews ---------- */

export interface ReviewDto {
  id: string;
  rating: number;
  comment: string | null;
  authorName: string;
  createdAt: string;
}

export interface AdminReviewDto extends ReviewDto {
  status: ReviewStatus;
  product: { id: string; slug: string; name: LocalizedText };
  user: { id: string; email: string };
}

/* ---------- admin ---------- */

export interface AdminUserDto {
  id: string;
  email: string;
  emailVerified: boolean;
  firstName: string;
  lastName: string | null;
  phone: string | null;
  role: UserRole;
  isBlocked: boolean;
  orderCount: number;
  createdAt: string;
}

export interface AdminProductDto extends ProductDetailDto {
  isArchived: boolean;
  sortOrder: number;
  imageKey: string | null;
  updatedAt: string;
}

export interface AdminCategoryDto extends CategoryDto {
  isActive: boolean;
  isArchived: boolean;
}

export interface AdminIngredientDto extends IngredientDto {
  imageKey: string | null;
  isArchived: boolean;
}

export interface AdminCrustDto extends CrustDto {
  isArchived: boolean;
}

export interface PromoCodeDto {
  id: string;
  code: string;
  description: string | null;
  type: PromoType;
  value: number;
  maxDiscount: number | null;
  minOrderAmount: number;
  startsAt: string | null;
  expiresAt: string | null;
  usageLimit: number | null;
  perUserLimit: number | null;
  usedCount: number;
  isActive: boolean;
  productIds: string[];
  categoryIds: string[];
  createdAt: string;
}

export interface AuditLogDto {
  id: string;
  actor: { id: string; email: string } | null;
  action: string;
  entityType: string;
  entityId: string | null;
  metadata: unknown;
  ip: string | null;
  createdAt: string;
}

export interface DashboardStatsDto {
  currency: Currency;
  periodDays: number;
  revenue: number;
  orders: number;
  newCustomers: number;
  averageOrderValue: number;
  cancelledOrders: number;
  salesByDay: { date: string; revenue: number; orders: number }[];
  popularProducts: { productId: string; name: LocalizedText; quantity: number; revenue: number }[];
  recentOrders: AdminOrderSummaryDto[];
  ordersByStatus: { status: OrderStatus; count: number }[];
}

export interface StoreSettingsDto {
  currency: Currency;
  isAcceptingOrders: boolean;
  deliveryFee: number;
  freeDeliveryThreshold: number | null;
  minOrderAmount: number;
  pickupAddress: string;
  supportPhone: string;
  exchangeRates: ExchangeRates;
}

export interface UploadResultDto {
  key: string;
  url: string;
  width: number;
  height: number;
  size: number;
}

export interface GeocodeResultDto {
  displayName: string;
  country: string | null;
  city: string | null;
  street: string | null;
  latitude: number;
  longitude: number;
}
