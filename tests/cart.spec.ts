import { test, expect } from './fixtures.ts';
import {
  addToCartButton,
  cartBadge,
  cartCheckoutButton,
  cartDrawer,
  cartDrawerCheckout,
  cartIconButton,
  cartEmptyPlaceholder,
  cartLineList,
  productCardBySlug,
} from '../lib/locators.ts';

const TOTE = 'canvas-tote-bag';
const CANDLE = 'beeswax-candle';

test.describe('Cart', () => {
  test('[TC-CART-001] add to cart updates the badge @P0', async ({ page }) => {
    await page.goto('/products', { waitUntil: 'domcontentloaded' });
    await addToCartButton(productCardBySlug(page, TOTE)).click();
    await expect(cartBadge(page)).toHaveText('1');
  });

  test('[TC-CART-002] cart icon opens the drawer with the added line @P1', async ({ page }) => {
    await page.goto('/products', { waitUntil: 'domcontentloaded' });
    await addToCartButton(productCardBySlug(page, TOTE)).click();
    await expect(cartBadge(page)).toHaveText('1');

    await cartIconButton(page).click();

    await expect(cartDrawer(page)).toHaveAttribute('data-state', /open/);
    await expect(cartDrawerCheckout(page)).toBeVisible();
  });

  test('[TC-CART-003] cart persists across reload @P1', async ({ page }) => {
    await page.goto('/products', { waitUntil: 'domcontentloaded' });
    await addToCartButton(productCardBySlug(page, TOTE)).click();
    await expect(cartBadge(page)).toHaveText('1');

    await page.reload({ waitUntil: 'domcontentloaded' });

    await expect(cartBadge(page)).toHaveText('1');
  });

  test('[TC-CART-004] increment qty updates badge, line total, cart total @P0', async ({ page }) => {
    await page.goto('/products', { waitUntil: 'domcontentloaded' });
    await addToCartButton(productCardBySlug(page, TOTE)).click();
    await expect(cartBadge(page)).toHaveText('1');

    await page.goto('/cart', { waitUntil: 'domcontentloaded' });

    const list = cartLineList(page);
    const lineTotal = list.getByTestId(`cart-line-total-${TOTE}`);
    await expect(lineTotal).toHaveText('$28.00');

    await list.getByTestId(`cart-line-${TOTE}-qty-increment`).click();

    await expect(cartBadge(page)).toHaveText('2');
    await expect(lineTotal).toHaveText('$56.00');
    await expect(page.getByTestId('cart-total')).toHaveText('$56.00');
  });

  test('[TC-CART-005] remove the last line returns the cart to its empty state @P0', async ({ page }) => {
    await page.goto('/products', { waitUntil: 'domcontentloaded' });
    await addToCartButton(productCardBySlug(page, TOTE)).click();
    await expect(cartBadge(page)).toHaveText('1');

    await page.goto('/cart', { waitUntil: 'domcontentloaded' });
    await cartLineList(page).getByTestId(`cart-line-remove-${TOTE}`).click();

    await expect(cartEmptyPlaceholder(page)).toBeVisible();
    await expect(cartBadge(page)).toHaveCount(0);
  });

  test('[TC-CART-006] removing one of two lines leaves the other intact @P0', async ({ page }) => {
    await page.goto('/products', { waitUntil: 'domcontentloaded' });
    await addToCartButton(productCardBySlug(page, TOTE)).click();
    await addToCartButton(productCardBySlug(page, CANDLE)).click();
    await expect(cartBadge(page)).toHaveText('2');

    await page.goto('/cart', { waitUntil: 'domcontentloaded' });
    const list = cartLineList(page);
    await list.getByTestId(`cart-line-remove-${TOTE}`).click();

    await expect(list.getByTestId(`cart-line-${TOTE}`)).toHaveCount(0);
    await expect(list.getByTestId(`cart-line-${CANDLE}`)).toBeVisible();
    await expect(cartBadge(page)).toHaveText('1');
  });

  test('[TC-CART-007] decrement qty reduces badge and line total @P1', async ({ page }) => {
    await page.goto('/products', { waitUntil: 'domcontentloaded' });
    await addToCartButton(productCardBySlug(page, TOTE)).click();
    await page.goto('/cart', { waitUntil: 'domcontentloaded' });

    const list = cartLineList(page);
    await list.getByTestId(`cart-line-${TOTE}-qty-increment`).click();
    await expect(cartBadge(page)).toHaveText('2');

    await list.getByTestId(`cart-line-${TOTE}-qty-decrement`).click();

    await expect(cartBadge(page)).toHaveText('1');
    await expect(list.getByTestId(`cart-line-total-${TOTE}`)).toHaveText('$28.00');
  });

  test('[TC-CART-008] anonymous "Proceed to checkout" redirects to /login with redirect param @P0', async ({ page }) => {
    await page.goto('/products', { waitUntil: 'domcontentloaded' });
    await addToCartButton(productCardBySlug(page, TOTE)).click();

    await page.goto('/cart', { waitUntil: 'domcontentloaded' });
    await cartCheckoutButton(page).click();

    await expect(page).toHaveURL(/\/login\?redirect=%2Fcheckout/);
    // The cart survives the bounce, items live in localStorage, not session state.
    const cart = await page.evaluate(() =>
      JSON.parse(window.localStorage.getItem('ec_cart_v1') ?? 'null'),
    );
    expect(cart?.items?.length ?? 0).toBe(1);
  });

  // Seed a corrupt `ec_cart_v1` value, then reload so the React tree
  // re-reads localStorage on mount. Visit `/` first so the storage
  // write is bound to the SUT origin.
  async function seedCorruptCart(page: import('@playwright/test').Page, raw: string) {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.evaluate(
      ([blob]: [string]) => window.localStorage.setItem('ec_cart_v1', blob),
      [raw] as [string],
    );
    await page.reload({ waitUntil: 'domcontentloaded' });
  }

  // Contract: cart hydration must fail-safe on corrupted `ec_cart_v1`.
  // Parameterised over three shapes so the failure message names the
  // specific input. "invalid JSON" passes today; the two valid-JSON
  // wrong-shape cases are B-007 and marked test.fail() until the SUT
  // validates the parsed shape.
  for (const { label, blob, bug } of [
    { label: 'invalid JSON', blob: '{not-json', bug: null as string | null },
    { label: 'wrong root shape (string instead of object)', blob: '"hello"', bug: 'B-007' },
    { label: 'wrong items shape (string instead of array)', blob: '{"items":"oops"}', bug: 'B-007' },
  ]) {
    test(`[TC-CART-009] cart fail-safe: ${label} renders empty state, no crash @P0`, async ({
      page,
    }) => {
      if (bug) {
        test.fail(
          true,
          `${bug}: readFromStorage returns the malformed value because JSON.parse succeeded; ` +
            'the reducer then operates on it (e.g. .items.map on a string) and crashes.',
        );
      }
      await seedCorruptCart(page, blob);
      await page.goto('/cart', { waitUntil: 'domcontentloaded' });

      // Fail-safe contract: empty placeholder, no badge, no user-facing
      // alert. The alert check matters because a try/catch that still
      // surfaces a crash banner would pass the first two assertions.
      await expect(cartEmptyPlaceholder(page)).toBeVisible();
      await expect(cartBadge(page)).toHaveCount(0);
      await expect(page.getByRole('alert')).toHaveCount(0);
    });
  }

  // Separate test: after the fail-safe path runs, a normal add still
  // works. Catches a regression where the corruption path locks the
  // store into a read-only state. Uses the "invalid JSON" case so the
  // recovery assertion isn't coupled to B-007's failing shapes.
  test('[TC-CART-010] cart recovers from a corrupt blob: normal add still works @P0', async ({
    page,
  }) => {
    await seedCorruptCart(page, '{not-json');
    await page.goto('/cart', { waitUntil: 'domcontentloaded' });
    await expect(cartEmptyPlaceholder(page)).toBeVisible();

    await page.goto('/products', { waitUntil: 'domcontentloaded' });
    await addToCartButton(productCardBySlug(page, TOTE)).click();
    await expect(cartBadge(page)).toHaveText('1');
  });
});
