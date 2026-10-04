import { expect, test } from '@playwright/test';
import { login, readVerificationCode, USER } from './helpers';

test.describe('authentication', () => {
  test('register, verify e-mail with the code, sign out and sign in again', async ({
    page,
    request,
  }) => {
    const email = `e2e+${Date.now()}@example.com`;
    const password = 'Pizza12345';

    await page.goto('/register');
    await page.getByLabel('Имя', { exact: true }).fill('Тест');
    await page.getByLabel('E-mail').fill(email);
    await page.getByLabel('Пароль', { exact: true }).fill(password);
    await page.getByLabel('Повторите пароль').fill(password);
    await page.getByRole('button', { name: 'Создать аккаунт' }).click();

    await expect(page).toHaveURL(/\/verify-email/);
    const code = await readVerificationCode(request, email);
    await page.getByLabel('Код подтверждения').fill(code);
    await page.getByRole('button', { name: 'Подтвердить' }).click();
    await page.waitForURL('/');

    // signed in: the account page is reachable
    await page.goto('/account');
    await expect(page.getByRole('heading', { name: 'Профиль' })).toBeVisible();

    await page.goto('/account/security');
    await page.getByRole('button', { name: 'Выйти на всех устройствах' }).click();
    await page.waitForURL(/\/login/);

    await login(page, { email, password }, '/account');
    await expect(page.getByRole('heading', { name: 'Профиль' })).toBeVisible();
  });

  test('wrong password shows an error and private pages redirect to login', async ({ page }) => {
    await page.goto('/orders');
    await expect(page).toHaveURL(/\/login\?next=%2Forders/);

    await page.getByLabel('E-mail').fill(USER.email);
    await page.getByLabel('Пароль', { exact: true }).fill('wrong-password-1');
    await page.getByRole('button', { name: 'Войти', exact: true }).click();
    await expect(page.getByRole('alert')).toContainText('Неверный e-mail или пароль');
  });
});
