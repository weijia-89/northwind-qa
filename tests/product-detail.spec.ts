import { test, expect } from './fixtures.ts';
import { cartLineList } from '../lib/locators.ts';

const IN_STOCK = 'canvas-tote-bag';
const OUT_OF_STOCK = 'wool-felt-fedora';
const APPAREL = 'classic-white-tee-mens';

test.describe('Product detail @P0', () => {
  test('[TC-PDP-001] non-apparel PDP renders name, price, description, image', async ({ page }) => {
    await page.goto(`/products/${IN_STOCK}`, { waitUntil: 'domcontentloaded' });

    await expect(page.getByTestId('page-product-detail')).toHaveAttribute(
      'data-product-slug',
      IN_STOCK,
    );
    await expect(page.getByTestId('product-name')).toHaveText('Heavy Canvas Tote Bag');
    await expect(page.getByTestId('product-price')).toHaveText('$28.00');
    await expect(page.getByTestId('product-description')).toBeVisible();
    await expect(page.getByRole('img', { name: 'Heavy Canvas Tote Bag' })).toBeVisible();
  });

  test('[TC-PDP-002] in-stock PDP shows enabled "Add to cart" after stock check', async ({ page }) => {
    await page.goto(`/products/${IN_STOCK}`, { waitUntil: 'domcontentloaded' });

    const cta = page.getByTestId('add-to-cart');
    await expect(cta).toHaveText('Add to cart');
    await expect(cta).toBeEnabled();
  });

  test('[TC-PDP-003] out-of-stock PDP disables CTA with "Out of stock"', async ({ page }) => {
    await page.goto(`/products/${OUT_OF_STOCK}`, { waitUntil: 'domcontentloaded' });

    const cta = page.getByTestId('add-to-cart');
    // The PDP runs a 300ms stock check; auto-wait on the text resolves it.
    await expect(cta).toHaveText('Out of stock');
    await expect(cta).toBeDisabled();
  });

  test('[TC-PDP-004] apparel: size required, then size + qty 2 lands in cart', async ({ page }) => {
    await page.goto(`/products/${APPAREL}`, { waitUntil: 'domcontentloaded' });

    await expect(page.getByTestId('size-selector')).toBeVisible();

    // Submitting without a size shows a warning toast and doesn't add a line.
    await page.getByTestId('add-to-cart').click();
    await expect(page.getByText('Please select a size')).toBeVisible();
    await expect(page.getByTestId('cart-badge')).toHaveCount(0);

    await page.getByTestId('size-option-M').click();
    await expect(page.getByTestId('size-option-M')).toHaveAttribute('data-selected', 'true');
    await page.getByTestId('qty-increment').click();
    await expect(page.getByTestId('qty-value')).toHaveValue('2');

    await page.getByTestId('add-to-cart').click();
    await expect(page.getByTestId('cart-badge')).toHaveText('2');

    await page.goto('/cart', { waitUntil: 'domcontentloaded' });
    const cartList = cartLineList(page);
    await expect(cartList.getByTestId(`cart-line-${APPAREL}`)).toBeVisible();
    await expect(cartList.getByText('Size: M')).toBeVisible();
  });

  test('[TC-PDP-005] unknown slug renders product-detail-missing placeholder @P2', async ({ page }) => {
    await page.goto('/products/zzz-not-a-real-slug', { waitUntil: 'domcontentloaded' });

    await expect(page.getByTestId('page-product-detail-missing')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Back to shop' })).toBeVisible();
  });
});
