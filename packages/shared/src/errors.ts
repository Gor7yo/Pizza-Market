/**
 * Machine-readable error codes returned by the API in `error.code`.
 * The web app maps them to translated messages.
 */
export const ERROR_CODES = [
  'VALIDATION_ERROR',
  'UNAUTHORIZED',
  'FORBIDDEN',
  'NOT_FOUND',
  'CONFLICT',
  'RATE_LIMITED',
  'INTERNAL_ERROR',
  'BAD_REQUEST',
  // auth
  'INVALID_CREDENTIALS',
  'EMAIL_NOT_VERIFIED',
  'EMAIL_TAKEN',
  'ACCOUNT_BLOCKED',
  'INVALID_CODE',
  'CODE_EXPIRED',
  'TOO_MANY_ATTEMPTS',
  'INVALID_TOKEN',
  'SESSION_EXPIRED',
  'PASSWORD_NOT_SET',
  'OAUTH_FAILED',
  'CSRF_REJECTED',
  // catalog / cart
  'PRODUCT_UNAVAILABLE',
  'INVALID_CONFIGURATION',
  'CART_EMPTY',
  // promo
  'PROMO_NOT_FOUND',
  'PROMO_INACTIVE',
  'PROMO_EXPIRED',
  'PROMO_NOT_STARTED',
  'PROMO_MIN_ORDER',
  'PROMO_USAGE_LIMIT',
  'PROMO_NOT_APPLICABLE',
  // orders
  'MIN_ORDER_AMOUNT',
  'ADDRESS_REQUIRED',
  'INVALID_STATUS_TRANSITION',
  'ORDER_NOT_CANCELLABLE',
  'STORE_CLOSED',
  'IDEMPOTENCY_CONFLICT',
  // payments
  'PAYMENT_NOT_ALLOWED',
  // reviews
  'REVIEW_NOT_ALLOWED',
  'REVIEW_EXISTS',
  // files
  'INVALID_FILE',
] as const;

export type ErrorCode = (typeof ERROR_CODES)[number];

export interface ApiErrorBody {
  error: {
    code: ErrorCode;
    message: string;
    /** Field-level validation issues: path -> message key */
    fields?: Record<string, string>;
    requestId?: string;
  };
}

export function isApiErrorBody(value: unknown): value is ApiErrorBody {
  return (
    typeof value === 'object' &&
    value !== null &&
    'error' in value &&
    typeof (value as { error: unknown }).error === 'object' &&
    (value as { error: { code?: unknown } }).error.code !== undefined
  );
}
