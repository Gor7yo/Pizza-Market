import { CURRENCIES } from '@market/shared';
import { z } from 'zod';

const secret = z.string().min(32, 'must be at least 32 characters');
const optionalString = z
  .string()
  .optional()
  .transform((v) => (v && v.trim().length > 0 ? v.trim() : undefined));

export const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().default(4000),
    LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
    /** Comma-separated list of allowed browser origins (CORS + CSRF origin check) */
    WEB_ORIGIN: z
      .string()
      .default('http://localhost:3000')
      .transform((v) =>
        v
          .split(',')
          .map((o) => o.trim().replace(/\/$/, ''))
          .filter(Boolean),
      ),
    /** Public URL of the web app, used in e-mail links and OAuth redirects */
    PUBLIC_WEB_URL: z.url().default('http://localhost:3000'),
    /** Express "trust proxy" hop count (the Next.js rewrite proxy counts as one) */
    TRUST_PROXY: z.coerce.number().int().min(0).default(1),

    DATABASE_URL: z.string().min(1),
    REDIS_URL: z.string().min(1).default('redis://localhost:6379'),

    JWT_ACCESS_SECRET: secret,
    JWT_ACCESS_TTL_SECONDS: z.coerce.number().int().min(60).max(3600).default(900),
    REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().min(1).max(90).default(30),
    /** Key for HMAC of verification codes / reset tokens */
    CODE_HMAC_SECRET: secret,
    COOKIE_SECURE: z.stringbool().optional(),
    COOKIE_DOMAIN: optionalString,

    STORE_CURRENCY: z.enum(CURRENCIES).default('AMD'),
    /** IANA time zone used to group analytics by calendar day */
    STORE_TIMEZONE: z.string().default('Asia/Yerevan'),

    GOOGLE_CLIENT_ID: optionalString,
    GOOGLE_CLIENT_SECRET: optionalString,
    /** Must point to the web origin (proxied to the API) so cookies are first-party */
    GOOGLE_REDIRECT_URI: optionalString,

    EMAIL_PROVIDER: z.enum(['console', 'resend']).default('console'),
    RESEND_API_KEY: optionalString,
    EMAIL_FROM: z.string().default('Tonir Pizza <no-reply@example.com>'),

    S3_ENDPOINT: optionalString,
    S3_REGION: z.string().default('us-east-1'),
    S3_BUCKET: z.string().default('market'),
    S3_ACCESS_KEY_ID: z.string().default('devaccesskey'),
    S3_SECRET_ACCESS_KEY: z.string().default('devsecretkey'),
    S3_FORCE_PATH_STYLE: z.stringbool().default(true),
    /** Public base URL objects are served from, e.g. http://localhost:8333/market */
    S3_PUBLIC_URL: z.url().default('http://localhost:8333/market'),
    /** Create the bucket on startup if it does not exist (local development) */
    S3_AUTO_CREATE_BUCKET: z.stringbool().default(false),

    PAYMENT_PROVIDER: z.enum(['mock']).default('mock'),

    GEOCODER_PROVIDER: z.enum(['nominatim', 'none']).default('nominatim'),
    NOMINATIM_URL: z.url().default('https://nominatim.openstreetmap.org'),
    GEOCODER_USER_AGENT: z.string().default('tonir-pizza-dev/1.0 (admin@example.com)'),

    SWAGGER_ENABLED: z.stringbool().optional(),
    /** Exposes /api/v1/dev/* helpers (captured e-mails). Never allowed in production. */
    DEV_ENDPOINTS_ENABLED: z.stringbool().default(false),
  })
  .superRefine((env, ctx) => {
    if (env.NODE_ENV === 'production') {
      if (env.DEV_ENDPOINTS_ENABLED) {
        ctx.addIssue({
          code: 'custom',
          path: ['DEV_ENDPOINTS_ENABLED'],
          message: 'forbidden in production',
        });
      }
      if (env.EMAIL_PROVIDER === 'console') {
        ctx.addIssue({
          code: 'custom',
          path: ['EMAIL_PROVIDER'],
          message: 'use a real provider in production',
        });
      }
    }
    if (env.EMAIL_PROVIDER === 'resend' && !env.RESEND_API_KEY) {
      ctx.addIssue({ code: 'custom', path: ['RESEND_API_KEY'], message: 'required for resend' });
    }
    // Google sign-in is optional: enabled only when the client id + secret are present.
    // The redirect URI may be pre-filled (it is in .env.example) without enabling it.
    if (Boolean(env.GOOGLE_CLIENT_ID) !== Boolean(env.GOOGLE_CLIENT_SECRET)) {
      ctx.addIssue({
        code: 'custom',
        path: ['GOOGLE_CLIENT_ID'],
        message: 'GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET must be set together',
      });
    }
    if (env.GOOGLE_CLIENT_ID && !env.GOOGLE_REDIRECT_URI) {
      ctx.addIssue({
        code: 'custom',
        path: ['GOOGLE_REDIRECT_URI'],
        message: 'required for Google sign-in',
      });
    }
  });

export type Env = z.output<typeof envSchema>;

export function validateEnv(raw: Record<string, unknown>): Env {
  const result = envSchema.safeParse(raw);
  if (!result.success) {
    const issues = result.error.issues
      .map((i) => `  - ${i.path.join('.')}: ${i.message}`)
      .join('\n');
    throw new Error(`Invalid environment configuration:\n${issues}`);
  }
  return result.data;
}
