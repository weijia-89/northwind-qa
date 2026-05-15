import { test, expect } from './fixtures.ts';
import {
  addToCartButton,
  cartTotal,
  productCardBySlug,
  promoApplied,
  promoApply,
  promoError,
  promoInput,
  promoRemove,
  summaryDiscount,
  summarySubtotal,
} from '../lib/locators.ts';

const TOTE = 'canvas-tote-bag';
const CANDLE = 'beeswax-candle';
const TOTE_PRICE = 28.0;
const CANDLE_PRICE = 24.0;
const STANDARD_SHIPPING = 5.99;
const FREE_SHIPPING_THRESHOLD = 50;

async function addToteAndOpenCart(page: import('@playwright/test').Page) {
  await page.goto('/products', { waitUntil: 'domcontentloaded' });
  await addToCartButton(productCardBySlug(page, TOTE)).click();
  await page.goto('/cart', { waitUntil: 'domcontentloaded' });
}

function dollars(text: string | null): number {
  const match = /\$([0-9]+(?:\.[0-9]{2})?)/.exec(text ?? '');
  if (!match) throw new Error(`No dollar amount in: ${text}`);
  return Number(match[1]);
}

test.describe('Promo code', () => {
  test('[TC-PROMO-001] WELCOME10 applies 10% discount @P0', async ({ page }) => {
    await addToteAndOpenCart(page);

    await promoInput(page).fill('WELCOME10');
    await promoApply(page).click();

    await expect(promoApplied(page)).toContainText('WELCOME10');
    await expect(summarySubtotal(page)).toContainText(`$${TOTE_PRICE.toFixed(2)}`);
    await expect(summaryDiscount(page)).toContainText(`−$${(TOTE_PRICE * 0.1).toFixed(2)}`);

    const expectedTotal = TOTE_PRICE * 0.9 + STANDARD_SHIPPING;
    await expect(cartTotal(page)).toHaveText(`$${expectedTotal.toFixed(2)}`);
  });

  test('[TC-PROMO-002] invalid code surfaces an error @P0', async ({ page }) => {
    await addToteAndOpenCart(page);

    await promoInput(page).fill('SAVE10');
    await promoApply(page).click();

    await expect(promoError(page)).toHaveText('Invalid promo code');
    await expect(summaryDiscount(page)).toHaveCount(0);
  });

  test('[TC-PROMO-003] removing an applied promo restores the original total @P1', async ({ page }) => {
    await addToteAndOpenCart(page);

    await promoInput(page).fill('WELCOME10');
    await promoApply(page).click();
    await expect(promoApplied(page)).toBeVisible();

    await promoRemove(page).click();

    await expect(promoApplied(page)).toHaveCount(0);
    await expect(cartTotal(page)).toHaveText(`$${(TOTE_PRICE + STANDARD_SHIPPING).toFixed(2)}`);
  });

});
