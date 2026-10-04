import { expect, test } from '@playwright/test';
import { ADMIN, login, USER } from './helpers';

test.describe('admin', () => {
  test('regular users cannot open the admin panel', async ({ page, request }) => {
    await login(page, USER);
    await page.goto('/admin');
    await expect(page).toHaveURL('/');

    // the API rejects admin calls regardless of the UI
    const res = await page.request.get('/api/v1/admin/dashboard');
    expect(res.status()).toBe(403);
    const anonymous = await request.get('/api/v1/admin/dashboard');
    expect(anonymous.status()).toBe(401);
  });

  test('admin creates a product and moves an order through statuses', async ({ page }) => {
    await login(page, ADMIN, '/admin');
    await expect(page.getByRole('heading', { name: 'Дашборд' })).toBeVisible();

    // create a simple (non-configurable) product
    const slug = `e2e-lemonade-${Date.now()}`;
    await page.goto('/admin/products/new');
    await page.getByRole('group', { name: 'Название' }).getByLabel('RU').fill('Лимонад E2E');
    await page.getByLabel('URL (slug)').fill(slug);
    await page.getByLabel('Категория').selectOption({ label: 'Напитки' });
    await page.getByLabel(/Базовая цена/).fill('700');
    await page.getByLabel('Настраиваемый (размеры, борта, ингредиенты)').uncheck();
    await page.getByRole('button', { name: 'Сохранить' }).click();
    await expect(page.getByText('Товар сохранён')).toBeVisible();

    const storefront = await page.request.get(`/api/v1/products/${slug}`);
    expect(storefront.ok()).toBe(true);

    // order management: the seeded PREPARING order can move to READY
    await page.goto('/admin/orders');
    await page.getByLabel('Статус').selectOption({ label: 'Готовится' });
    await page
      .getByRole('link', { name: /^#\d+$/ })
      .first()
      .click();
    await page.getByRole('button', { name: '→ Готов' }).click();
    await expect(page.getByText('Статус обновлён')).toBeVisible();
    await expect(page.getByRole('button', { name: '→ В пути' })).toBeVisible();
  });
});
