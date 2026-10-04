import { defineConfig, devices } from '@playwright/test';

/**
 * E2E tests expect the full stack running with seeded data and
 * DEV_ENDPOINTS_ENABLED=true on the API (to read verification e-mails):
 *   pnpm infra:up && pnpm db:deploy && SEED_RESET=true pnpm db:seed && pnpm dev
 */
const baseURL = process.env.E2E_BASE_URL ?? 'http://localhost:3000';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL,
    locale: 'ru-RU',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile', use: { ...devices['Pixel 7'] }, testMatch: /storefront\.spec\.ts/ },
  ],
});
