import { expect, type APIRequestContext, type Page } from '@playwright/test';

export const USER = {
  email: 'user@tonir.local',
  password: process.env.SEED_USER_PASSWORD ?? 'User12345',
};
export const ADMIN = {
  email: 'admin@tonir.local',
  password: process.env.SEED_ADMIN_PASSWORD ?? 'Admin12345',
};

/** Reads the latest verification code captured by the API dev mailbox (DEV_ENDPOINTS_ENABLED=true). */
export async function readVerificationCode(
  request: APIRequestContext,
  email: string,
): Promise<string> {
  let code: string | undefined;
  await expect
    .poll(
      async () => {
        const res = await request.get(`/api/v1/dev/emails?to=${encodeURIComponent(email)}`);
        if (!res.ok()) return undefined;
        const mails = (await res.json()) as { text: string }[];
        code = mails[0] ? /(\d{6})/.exec(mails[0].text)?.[1] : undefined;
        return code;
      },
      { timeout: 15_000, message: 'verification e-mail did not arrive' },
    )
    .toBeTruthy();
  return code!;
}

export async function login(
  page: Page,
  credentials: { email: string; password: string },
  next = '/',
) {
  await page.goto(`/login?next=${encodeURIComponent(next)}`);
  await page.getByLabel('E-mail').fill(credentials.email);
  await page.getByLabel('Пароль', { exact: true }).fill(credentials.password);
  await page.getByRole('button', { name: 'Войти', exact: true }).click();
  await page.waitForURL((url) => url.pathname === next);
}
