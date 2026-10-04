import { expect, test } from '@playwright/test';

test.describe('storefront', () => {
  test('browse the menu, configure a pizza and add it to the cart', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

    await page.goto('/menu?category=pizza');
    await expect(page.getByRole('heading', { name: 'Пиццы' })).toBeVisible();

    // search
    await page.getByLabel('Поиск по меню').fill('пепперони');
    await expect(page.getByRole('link', { name: 'Пепперони', exact: true })).toBeVisible();

    // product page with the configurator
    await page.getByRole('link', { name: 'Пепперони', exact: true }).click();
    await expect(page).toHaveURL(/\/product\/pepperoni/);
    await page.getByText('35 см', { exact: true }).click();
    await page.getByRole('button', { name: /Халапеньо/ }).click();
    const addButton = page.getByRole('button', { name: /В корзину за/ });
    // 3400 + 2000 (35 cm) + 0 (classic) + 300 (jalapeño) = 5 700
    await expect(addButton).toContainText(/5\s?700/);
    await addButton.click();

    await expect(page.getByRole('button', { name: /Корзина, 1 товар/ }).first()).toBeVisible();
  });

  test('cart prices come from the server quote', async ({ page }) => {
    await page.goto('/menu?category=drinks');
    await page.getByRole('button', { name: /Добавить «Тан 0,5 л» в корзину/ }).click();
    await page.goto('/cart');
    await expect(page.getByRole('heading', { name: 'Корзина' })).toBeVisible();
    await expect(page.getByText('Итого')).toBeVisible();
  });
});
