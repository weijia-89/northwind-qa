import { test, expect } from './fixtures.ts';

test.describe('Homepage @P0', () => {
  test('[TC-HOME-001] / renders hero, category tiles, featured grid', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });

    await expect(page).toHaveTitle(/Northwind/i);
    await expect(page.getByTestId('page-home')).toBeVisible();

    const heroCta = page.getByTestId('hero-shop-cta');
    await expect(heroCta).toBeVisible();
    await expect(heroCta).toHaveAttribute('href', '/products');

    for (const slug of ['apparel-mens', 'apparel-womens', 'accessories', 'home']) {
      await expect(page.getByTestId(`category-tile-${slug}`)).toBeVisible();
    }

    await expect(page.getByTestId('product-grid').first()).toBeVisible();
  });

  test('[TC-HOME-002] hero CTA navigates to /products and shows the grid', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.getByTestId('hero-shop-cta').click();

    await expect(page).toHaveURL(/\/products$/);
    await expect(page.getByTestId('product-grid')).toBeVisible();
  });
});
