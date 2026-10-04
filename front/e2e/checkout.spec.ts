import { expect, test } from '@playwright/test';
import { login, USER } from './helpers';

test.describe('checkout and tracking', () => {
  test('place a pickup order paid by card (mock) and track it', async ({ page }) => {
    await login(page, USER);

    await page.goto('/product/margherita');
    await page.getByRole('button', { name: /В корзину за/ }).click();
    await page.goto('/menu?category=pizza');
    await page.goto('/product/four-cheese');
    await page.getByRole('button', { name: /В корзину за/ }).click();

    await page.goto('/checkout');
    await page.getByText('Самовывоз', { exact: true }).click();
    await page.getByLabel('Телефон').fill('+37491000000');
    await page.getByText('Картой онлайн', { exact: true }).click();

    const placeOrder = page.getByRole('button', { name: 'Оформить заказ' }).first();
    await expect(placeOrder).toBeEnabled();
    // a double click must not create two orders (idempotency key)
    await placeOrder.dblclick();

    await page.waitForURL(/\/checkout\/pay\//);
    await page.getByRole('button', { name: 'Оплатить' }).click();

    await page.waitForURL(/\/orders\/.+\?placed=1/);
    await expect(page.getByText('Спасибо! Заказ оформлен.')).toBeVisible();
    await expect(page.getByRole('list', { name: 'Статус заказа' })).toBeVisible();
    await expect(page.getByText('Оплачен')).toBeVisible();

    // repeat order puts the items back into the cart
    await page.getByRole('button', { name: 'Повторить заказ' }).click();
    await expect(page.getByRole('dialog', { name: 'Корзина' })).toBeVisible();
  });
});
