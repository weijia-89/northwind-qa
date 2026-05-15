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

  // Regression guard for B-003: applying a valid promo to a cart that's just
  // over the free-shipping threshold pushes shipping back on and raises the
  // total. Marked as test.fail() — it will flip green when the SUT fixes the
  // shipping calculation to gate on pre-discount subtotal.
  test('[TC-PROMO-004] valid promo must never raise the total — B-003 @P0', async ({ page }) => {
    test.fail(true, 'B-003: shipping is computed on subtotalAfterDiscount, ' +
      'so WELCOME10 tips a $52 cart below $50 and adds $5.99 shipping.');

    // Build a $52 cart: $28 tote + $24 candle. Both non-apparel, no size gate.
    await page.goto('/products', { waitUntil: 'domcontentloaded' });
    await addToCartButton(productCardBySlug(page, TOTE)).click();
    await addToCartButton(productCardBySlug(page, CANDLE)).click();

    await page.goto('/cart', { waitUntil: 'domcontentloaded' });
    const subtotal = TOTE_PRICE + CANDLE_PRICE;
    expect(subtotal).toBeGreaterThanOrEqual(FREE_SHIPPING_THRESHOLD);

    const beforePromoTotal = dollars(await cartTotal(page).textContent());
    expect(beforePromoTotal).toBe(subtotal); // free shipping kicks in

    await promoInput(page).fill('WELCOME10');
    await promoApply(page).click();
    await expect(promoApplied(page)).toBeVisible();

    const afterPromoTotal = dollars(await cartTotal(page).textContent());
    // Invariant: a discount code can never make the customer pay more.
    expect(afterPromoTotal).toBeLessThanOrEqual(beforePromoTotal);
  });

  // Regression guard for B-002: WELCOME10 is locked forever in localStorage,
  // even after the user removes it and reloads. Marked as test.fail() — flips
  // green when the SUT switches to sessionStorage or per-order semantics.
  test('[TC-PROMO-005] reapplying WELCOME10 after removal + reload should work — B-002 @P1', async ({ page }) => {
    test.fail(true, 'B-002: ec_promo_used_v1 is permanent across reloads.');

    await addToteAndOpenCart(page);

    await promoInput(page).fill('WELCOME10');
    await promoApply(page).click();
    await expect(promoApplied(page)).toBeVisible();
    await promoRemove(page).click();
    await expect(promoApplied(page)).toHaveCount(0);

    await page.reload({ waitUntil: 'domcontentloaded' });

    await promoInput(page).fill('WELCOME10');
    await promoApply(page).click();

    // Today: promoError surfaces "Code already used this session". After fix:
    // promoApplied returns. The two assertions together make this a clean flip.
    await expect(promoApplied(page)).toBeVisible();
    await expect(promoError(page)).toHaveCount(0);
  });

  // Regression guard for B-004: the "already used" guard only honours an
  // Array-shaped value at ec_promo_used_v1. Any other shape (e.g. {}) is
  // silently accepted and resets the record. Storage shape should be
  // validated; a corrupt value should fail-safe (refuse the promo), not
  // fail-open (treat as fresh). Marked test.fail() until the SUT validates
  // the storage shape.
  test('[TC-PROMO-006] tampering with ec_promo_used_v1 must not bypass the lock — B-004 @P1', async ({ page }) => {
    test.fail(true, 'B-004: corrupt promo-storage shape is treated as fresh, not as in-use.');

    await addToteAndOpenCart(page);

    // First apply succeeds and writes the lock.
    await promoInput(page).fill('WELCOME10');
    await promoApply(page).click();
    await expect(promoApplied(page)).toBeVisible();
    await promoRemove(page).click();

    // Simulate the DevTools tampering described in the bug report.
    await page.evaluate(() => {
      window.localStorage.setItem('ec_promo_used_v1', '{}');
    });

    // Re-apply. Today the SUT accepts it (fail-open). The fix is to reject
    // any non-array shape with a clear error.
    await promoInput(page).fill('WELCOME10');
    await promoApply(page).click();
    await expect(promoError(page)).toBeVisible();
    await expect(promoApplied(page)).toHaveCount(0);
  });
});
