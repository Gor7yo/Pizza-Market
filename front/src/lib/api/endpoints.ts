/**
 * Typed browser-side API surface. Request bodies use the shared Zod input types,
 * responses the shared DTOs - the web app never guesses response shapes.
 */
import type {
  AddressDto,
  AddressInput,
  AdminCategoryDto,
  AdminCrustDto,
  AdminIngredientDto,
  AdminOrderDetailDto,
  AdminOrderListQuery,
  AdminOrderSummaryDto,
  AdminProductDto,
  AdminProductListQuery,
  AdminReviewDto,
  AdminUpdateUserInput,
  AdminUserDto,
  AdminUserListQuery,
  AuditLogDto,
  AuditLogQuery,
  AuthResultDto,
  CartItemInput,
  CartQuoteDto,
  CategoryInput,
  ChangePasswordInput,
  CreateOrderInput,
  CreateReviewInput,
  CrustInput,
  DashboardStatsDto,
  EmailOnlyInput,
  GeocodeResultDto,
  IngredientInput,
  Locale,
  LoginInput,
  ModerateReviewInput,
  OrderDetailDto,
  OrderListQuery,
  OrderStatus,
  OrderSummaryDto,
  Paginated,
  PaymentDto,
  ProductCardDto,
  ProductDetailDto,
  ProductInput,
  ProductListQuery,
  PromoCodeDto,
  PromoCodeInput,
  QuoteCartInput,
  RegisterInput,
  RegisterResultDto,
  ResetPasswordInput,
  ReviewDto,
  ReviewStatus,
  ServerCartDto,
  SessionDto,
  StoreSettingsDto,
  StoreSettingsInput,
  UpdateProfileInput,
  UploadResultDto,
  UserDto,
  VerifyEmailInput,
} from '@market/shared';
import { api } from './client';

type Q = Record<string, string | number | boolean | string[] | null | undefined>;

export const authApi = {
  me: () => api<UserDto>('/auth/me', { skipRefresh: false }),
  providers: () => api<{ google: boolean }>('/auth/providers'),
  register: (body: RegisterInput) =>
    api<RegisterResultDto>('/auth/register', { method: 'POST', body, skipRefresh: true }),
  verifyEmail: (body: VerifyEmailInput) =>
    api<AuthResultDto>('/auth/verify-email', { method: 'POST', body, skipRefresh: true }),
  resendVerification: (body: EmailOnlyInput) =>
    api<void>('/auth/resend-verification', { method: 'POST', body, skipRefresh: true }),
  login: (body: LoginInput) =>
    api<AuthResultDto>('/auth/login', { method: 'POST', body, skipRefresh: true }),
  logout: () => api<void>('/auth/logout', { method: 'POST', skipRefresh: true }),
  logoutAll: () => api<void>('/auth/logout-all', { method: 'POST' }),
  forgotPassword: (body: EmailOnlyInput) =>
    api<void>('/auth/forgot-password', { method: 'POST', body, skipRefresh: true }),
  resetPassword: (body: ResetPasswordInput) =>
    api<void>('/auth/reset-password', { method: 'POST', body, skipRefresh: true }),
};

export const meApi = {
  update: (body: UpdateProfileInput) => api<UserDto>('/me', { method: 'PATCH', body }),
  changePassword: (body: ChangePasswordInput) => api<void>('/me/password', { method: 'PUT', body }),
  uploadAvatar: (file: File) => {
    const form = new FormData();
    form.append('file', file);
    return api<UserDto>('/me/avatar', { method: 'POST', body: form });
  },
  removeAvatar: () => api<UserDto>('/me/avatar', { method: 'DELETE' }),
  sessions: () => api<SessionDto[]>('/me/sessions'),
  revokeSession: (id: string) => api<void>(`/me/sessions/${id}`, { method: 'DELETE' }),
  addresses: () => api<AddressDto[]>('/me/addresses'),
  createAddress: (body: AddressInput) => api<AddressDto>('/me/addresses', { method: 'POST', body }),
  updateAddress: (id: string, body: AddressInput) =>
    api<AddressDto>(`/me/addresses/${id}`, { method: 'PUT', body }),
  deleteAddress: (id: string) => api<void>(`/me/addresses/${id}`, { method: 'DELETE' }),
  favorites: () => api<ProductCardDto[]>('/me/favorites'),
  favoriteIds: () => api<string[]>('/me/favorites/ids'),
  addFavorite: (productId: string) => api<void>(`/me/favorites/${productId}`, { method: 'PUT' }),
  removeFavorite: (productId: string) =>
    api<void>(`/me/favorites/${productId}`, { method: 'DELETE' }),
};

export const catalogApi = {
  products: (query: ProductListQuery) =>
    api<Paginated<ProductCardDto>>('/products', { query: query as Q }),
  product: (slug: string) => api<ProductDetailDto>(`/products/${slug}`),
  reviews: (productId: string, page = 1) =>
    api<Paginated<ReviewDto>>(`/products/${productId}/reviews`, { query: { page, pageSize: 10 } }),
  settings: () => api<StoreSettingsDto>('/settings'),
};

export const cartApi = {
  quote: (body: QuoteCartInput) => api<CartQuoteDto>('/cart/quote', { method: 'POST', body }),
  get: () => api<ServerCartDto>('/cart'),
  replace: (items: CartItemInput[]) =>
    api<ServerCartDto>('/cart', { method: 'PUT', body: { items } }),
  merge: (items: CartItemInput[]) =>
    api<ServerCartDto>('/cart/merge', { method: 'POST', body: { items } }),
};

export const ordersApi = {
  create: (body: CreateOrderInput, idempotencyKey: string) =>
    api<OrderDetailDto>('/orders', {
      method: 'POST',
      body,
      headers: { 'Idempotency-Key': idempotencyKey },
    }),
  list: (query: OrderListQuery) =>
    api<Paginated<OrderSummaryDto>>('/orders', { query: query as Q }),
  get: (id: string) => api<OrderDetailDto>(`/orders/${id}`),
  cancel: (id: string) => api<OrderDetailDto>(`/orders/${id}/cancel`, { method: 'POST' }),
  mockConfirm: (id: string, outcome: 'success' | 'failure') =>
    api<PaymentDto>(`/orders/${id}/payment/mock-confirm`, { method: 'POST', body: { outcome } }),
  retryPayment: (id: string) => api<PaymentDto>(`/orders/${id}/payment/retry`, { method: 'POST' }),
};

export const reviewsApi = {
  create: (body: CreateReviewInput) => api<ReviewDto>('/reviews', { method: 'POST', body }),
};

export const geoApi = {
  reverse: (lat: number, lng: number, locale: Locale) =>
    api<GeocodeResultDto | null>('/geo/reverse', { query: { lat, lng, locale } }),
  search: (q: string, locale: Locale) =>
    api<GeocodeResultDto[]>('/geo/search', { query: { q, locale } }),
};

export const adminApi = {
  dashboard: (days: number) => api<DashboardStatsDto>('/admin/dashboard', { query: { days } }),

  products: (query: AdminProductListQuery) =>
    api<Paginated<AdminProductDto>>('/admin/products', { query: query as Q }),
  product: (id: string) => api<AdminProductDto>(`/admin/products/${id}`),
  createProduct: (body: ProductInput) =>
    api<AdminProductDto>('/admin/products', { method: 'POST', body }),
  updateProduct: (id: string, body: ProductInput) =>
    api<AdminProductDto>(`/admin/products/${id}`, { method: 'PUT', body }),
  archiveProduct: (id: string, isArchived: boolean) =>
    api<AdminProductDto>(`/admin/products/${id}/archive`, {
      method: 'PATCH',
      body: { isArchived },
    }),
  setProductAvailability: (id: string, isAvailable: boolean) =>
    api<AdminProductDto>(`/admin/products/${id}/availability`, {
      method: 'PATCH',
      body: { isAvailable },
    }),
  upload: (kind: 'product' | 'ingredient', file: File) => {
    const form = new FormData();
    form.append('file', file);
    return api<UploadResultDto>(`/admin/uploads/${kind}`, { method: 'POST', body: form });
  },

  categories: () => api<AdminCategoryDto[]>('/admin/categories'),
  createCategory: (body: CategoryInput) =>
    api<AdminCategoryDto[]>('/admin/categories', { method: 'POST', body }),
  updateCategory: (id: string, body: CategoryInput) =>
    api<AdminCategoryDto[]>(`/admin/categories/${id}`, { method: 'PUT', body }),
  archiveCategory: (id: string, isArchived: boolean) =>
    api<AdminCategoryDto[]>(`/admin/categories/${id}/archive`, {
      method: 'PATCH',
      body: { isArchived },
    }),

  ingredients: () => api<AdminIngredientDto[]>('/admin/ingredients'),
  createIngredient: (body: IngredientInput) =>
    api<AdminIngredientDto[]>('/admin/ingredients', { method: 'POST', body }),
  updateIngredient: (id: string, body: IngredientInput) =>
    api<AdminIngredientDto[]>(`/admin/ingredients/${id}`, { method: 'PUT', body }),
  archiveIngredient: (id: string, isArchived: boolean) =>
    api<AdminIngredientDto[]>(`/admin/ingredients/${id}/archive`, {
      method: 'PATCH',
      body: { isArchived },
    }),

  crusts: () => api<AdminCrustDto[]>('/admin/crusts'),
  createCrust: (body: CrustInput) =>
    api<AdminCrustDto[]>('/admin/crusts', { method: 'POST', body }),
  updateCrust: (id: string, body: CrustInput) =>
    api<AdminCrustDto[]>(`/admin/crusts/${id}`, { method: 'PUT', body }),
  archiveCrust: (id: string, isArchived: boolean) =>
    api<AdminCrustDto[]>(`/admin/crusts/${id}/archive`, { method: 'PATCH', body: { isArchived } }),

  orders: (query: AdminOrderListQuery) =>
    api<Paginated<AdminOrderSummaryDto>>('/admin/orders', { query: query as Q }),
  order: (id: string) => api<AdminOrderDetailDto>(`/admin/orders/${id}`),
  updateOrderStatus: (id: string, status: OrderStatus, note?: string) =>
    api<AdminOrderDetailDto>(`/admin/orders/${id}/status`, {
      method: 'PATCH',
      body: { status, note },
    }),

  users: (query: AdminUserListQuery) =>
    api<Paginated<AdminUserDto>>('/admin/users', { query: query as Q }),
  updateUser: (id: string, body: AdminUpdateUserInput) =>
    api<AdminUserDto>(`/admin/users/${id}`, { method: 'PATCH', body }),

  promoCodes: (query: { page?: number; pageSize?: number; q?: string }) =>
    api<Paginated<PromoCodeDto>>('/admin/promo-codes', { query }),
  createPromo: (body: PromoCodeInput) =>
    api<PromoCodeDto>('/admin/promo-codes', { method: 'POST', body }),
  updatePromo: (id: string, body: PromoCodeInput) =>
    api<PromoCodeDto>(`/admin/promo-codes/${id}`, { method: 'PUT', body }),
  deletePromo: (id: string) => api<void>(`/admin/promo-codes/${id}`, { method: 'DELETE' }),

  reviews: (query: { page?: number; pageSize?: number; status?: ReviewStatus }) =>
    api<Paginated<AdminReviewDto>>('/admin/reviews', { query }),
  moderateReview: (id: string, body: ModerateReviewInput) =>
    api<{ ok: true }>(`/admin/reviews/${id}`, { method: 'PATCH', body }),

  auditLogs: (query: AuditLogQuery) =>
    api<Paginated<AuditLogDto>>('/admin/audit-logs', { query: query as Q }),

  settings: () => api<StoreSettingsDto>('/admin/settings'),
  updateSettings: (body: StoreSettingsInput) =>
    api<StoreSettingsDto>('/admin/settings', { method: 'PUT', body }),
};
