/* Integration tests run against real PostgreSQL + Redis (docker compose up postgres redis).
 * They use a separate database: TEST_DATABASE_URL (default: market_test). */
import 'dotenv/config';

process.env.NODE_ENV = 'test';
process.env.DATABASE_URL =
  process.env.TEST_DATABASE_URL ?? 'postgresql://market:market@localhost:5433/market_test';
process.env.REDIS_URL = process.env.TEST_REDIS_URL ?? 'redis://localhost:6379/1';
process.env.JWT_ACCESS_SECRET ??= 'test-access-secret-test-access-secret-0123';
process.env.CODE_HMAC_SECRET ??= 'test-hmac-secret-test-hmac-secret-0123456';
process.env.EMAIL_PROVIDER = 'console';
process.env.DEV_ENDPOINTS_ENABLED = 'true';
process.env.GEOCODER_PROVIDER = 'none';
process.env.LOG_LEVEL = 'warn';
process.env.SWAGGER_ENABLED = 'false';
// lets tests simulate different client IPs through X-Forwarded-For
process.env.TRUST_PROXY = '1';
process.env.WEB_ORIGIN = 'http://localhost:3000';
