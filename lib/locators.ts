// Centralised locators. Priority: role > label > text > testId > CSS.
// testId is reserved for elements without a usable role or label (e.g. the
// promo input only has a placeholder; the cart-badge is presentation-only).
import type { Page, Locator } from '@playwright/test';

// ---------- Header ----------

export const navShop = (page: Page): Locator =>
  page.getByRole('link', { name: 'Shop', exact: true });

export const navHome = (page: Page): Locator =>
  page.getByRole('link', { name: 'Home', exact: true });

export const cartIconButton = (page: Page): Locator =>
  page.getByRole('button', { name: /^Cart with \d+ items?$/ });

// Badge only renders when itemCount > 0, so absence is meaningful.
export const cartBadge = (page: Page): Locator => page.getByTestId('cart-badge');

export const accountTrigger = (page: Page): Locator =>
  page.getByRole('button', { name: 'Account menu' });

// ---------- Cart drawer ----------

export const cartDrawer = (page: Page): Locator =>
  page.getByRole('complementary', { name: 'Shopping cart' });

export const cartDrawerCheckout = (page: Page): Locator =>
  page.getByTestId('cart-drawer-checkout');

export const cartDrawerView = (page: Page): Locator =>
  page.getByTestId('cart-drawer-view');

// ---------- Cart page ----------

// ╔══════════════════════════════════════════════════════════════════════╗
// ║  STRICT-MODE PITFALL, READ THIS BEFORE ADDING CART-LINE TESTS        ║
// ╠══════════════════════════════════════════════════════════════════════╣
// ║  CartDrawer mounts on EVERY page with the same `cart-line-*` testIds ║
// ║  as the cart page list. Any locator like                             ║
// ║      page.getByTestId('cart-line-canvas-tote-bag')                   ║
// ║  matches BOTH the drawer copy and the page copy, so Playwright       ║
// ║  strict mode fails with a duplicate-match error.                     ║
// ║                                                                      ║
// ║  ALWAYS scope cart-line assertions through one of:                   ║
// ║    cartLineList(page), the /cart page list (this helper)             ║
// ║    cartDrawer(page)  , the drawer panel above                        ║
// ║                                                                      ║
// ║  Example (correct):                                                  ║
// ║    const list = cartLineList(page);                                  ║
// ║    await expect(list.getByTestId(`cart-line-${slug}`)).toBeVisible();║
// ║                                                                      ║
// ║  Example (wrong, will fail strict mode):                             ║
// ║    await expect(page.getByTestId(`cart-line-${slug}`)).toBeVisible();║
// ╚══════════════════════════════════════════════════════════════════════╝
export const cartLineList = (page: Page): Locator =>
  page.getByTestId('cart-line-list');

export const cartEmptyPlaceholder = (page: Page): Locator =>
  page.getByTestId('cart-empty');

export const cartCheckoutButton = (page: Page): Locator =>
  page.getByTestId('cart-checkout');

// ---------- Product card / list ----------

/**
 * Add-to-cart button on a non-apparel product card.
 * Apparel cards (sizes != null) render a "Choose options" link instead.
 */
export const addToCartButton = (scope: Page | Locator): Locator =>
  scope.getByRole('button', { name: 'Add to cart' });

export const chooseOptionsLink = (scope: Page | Locator): Locator =>
  scope.getByRole('link', { name: 'Choose options' });

export const productCardBySlug = (page: Page, slug: string): Locator =>
  page.getByTestId(`product-card-${slug}`);

// ---------- Auth forms ----------

// FormField renders <label>Email<span aria-hidden> *</span></label>, so the
// label's text content is "Email *". `getByLabel` matches the label text
// (which still contains the asterisk), but `getByRole` uses the accessible
// name (where aria-hidden content is stripped), that's "Email" exactly.
export const emailInput = (page: Page): Locator =>
  page.getByRole('textbox', { name: 'Email', exact: true });

export const passwordInput = (page: Page): Locator =>
  page.getByRole('textbox', { name: 'Password', exact: true });

export const signInSubmit = (page: Page): Locator =>
  page.getByRole('button', { name: 'Sign in', exact: true });

// ---------- Promo ----------

// PromoCodeInput has no <label>, only a placeholder. TestId is the right tool.
export const promoInput = (page: Page): Locator => page.getByTestId('promo-input');
export const promoApply = (page: Page): Locator => page.getByTestId('promo-apply');
export const promoApplied = (page: Page): Locator => page.getByTestId('promo-applied');
export const promoError = (page: Page): Locator => page.getByTestId('promo-error');
export const promoRemove = (page: Page): Locator => page.getByTestId('promo-remove');

// ---------- Order summary ----------

export const summarySubtotal = (page: Page): Locator => page.getByTestId('summary-subtotal');
export const summaryDiscount = (page: Page): Locator => page.getByTestId('summary-discount');
export const summaryShipping = (page: Page): Locator => page.getByTestId('summary-shipping');
export const cartTotal = (page: Page): Locator => page.getByTestId('cart-total');

// ---------- Product list controls ----------

// Both have visually-hidden <label> elements wired via htmlFor, getByLabel works.
export const searchInput = (page: Page): Locator =>
  page.getByLabel('Search products', { exact: true });

export const sortSelect = (page: Page): Locator =>
  page.getByLabel('Sort by', { exact: true });

export const categoryChip = (page: Page, name: string): Locator =>
  page
    .getByRole('group', { name: 'Filter by category' })
    .getByRole('button', { name, exact: true });

// ---------- Checkout ----------

export const placeOrderButton = (page: Page): Locator => page.getByTestId('place-order');
export const checkoutError = (page: Page): Locator => page.getByTestId('checkout-error');
