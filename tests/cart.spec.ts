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
});
