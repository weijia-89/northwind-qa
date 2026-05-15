import type { Page } from '@playwright/test';
import { test, expect } from './fixtures.ts';
import {
  addToCartButton,
  checkoutError,
  placeOrderButton,
  productCardBySlug,
} from '../lib/locators.ts';

const TOTE_SLUG = 'canvas-tote-bag';

const TEST_CARD = '4242 4242 4242 4242';
const TEST_EXPIRY = '12/30';
const TEST_CVC = '123';

async function fillShipping(page: Page) {
  await page.getByLabel('Full name').fill('Test Customer');
  await page.getByLabel('Address line 1').fill('1 Market Street');
  await page.getByLabel('City').fill('Anytown');
  await page.getByLabel('ZIP / Postal code').fill('94105');
  await page.getByLabel('Country').fill('United States');
}

async function fillPayment(page: Page, card: string) {
  await page.getByLabel('Cardholder name').fill('Test Customer');
  await page.getByLabel('Card number').fill(card);
  await page.getByLabel('Expiry (MM/YY)').fill(TEST_EXPIRY);
  await page.getByLabel('CVC').fill(TEST_CVC);
}

test.describe('Checkout — authenticated', () => {
  test('[TC-CHECKOUT-001] Happy path: cart → checkout → place order → confirmation @P0', async ({
    page,
  }) => {
    await page.goto('/products', { waitUntil: 'domcontentloaded' });
    await addToCartButton(productCardBySlug(page, TOTE_SLUG)).click();
    await expect(page.getByTestId('cart-badge')).toHaveText('1');

    await page.goto('/checkout', { waitUntil: 'domcontentloaded' });
    await expect(page.getByTestId('page-checkout')).toBeVisible();

    await fillShipping(page);
    await fillPayment(page, TEST_CARD);

    await placeOrderButton(page).click();

    await expect(page).toHaveURL(/\/checkout\/confirmation\/.+/);
    await expect(page.getByText('Order placed!')).toBeVisible();

    const persisted = await page.evaluate(() => ({
      orders: JSON.parse(window.localStorage.getItem('ec_orders_v1') ?? '[]'),
      cart: JSON.parse(window.localStorage.getItem('ec_cart_v1') ?? 'null'),
    }));
    expect(persisted.orders.length).toBeGreaterThanOrEqual(1);
    const last = persisted.orders[persisted.orders.length - 1];
    expect(last.userEmail).toBe('test@example.com');
    expect(last.shipping.fullName).toBe('Test Customer');
    expect(last.items[0].slug).toBe(TOTE_SLUG);
    expect(persisted.cart?.items ?? []).toEqual([]);
  });

  test('[TC-CHECKOUT-002] Empty cart shows page-checkout-empty instead of the form @P1', async ({
    page,
  }) => {
    await page.goto('/checkout', { waitUntil: 'domcontentloaded' });

    await expect(page.getByTestId('page-checkout-empty')).toBeVisible();
    await expect(placeOrderButton(page)).toHaveCount(0);
  });

  test('[TC-CHECKOUT-003] Place order with invalid card number is blocked with validation error @P1', async ({
    page,
  }) => {
    await page.goto('/products', { waitUntil: 'domcontentloaded' });
    await addToCartButton(productCardBySlug(page, TOTE_SLUG)).click();
    await page.goto('/checkout', { waitUntil: 'domcontentloaded' });

    await fillShipping(page);
    await fillPayment(page, '1234 5678 9012 3456');

    await placeOrderButton(page).click();

    await expect(checkoutError(page)).toBeVisible();
    await expect(checkoutError(page)).toContainText(/card/i);
    await expect(page).not.toHaveURL(/\/checkout\/confirmation/);
  });
});
