// Order history tests for /account.
//
// These tests fill a documented gap in COVERAGE.md ("No /account order
// history assertion"). The happy-path checkout test (TC-CHECKOUT-001)
// proves an order is persisted to `ec_orders_v1`; this file proves the
// AccountPage actually renders that data, and renders it filtered by
// userEmail so cross-user leakage would surface as a hard failure.
//
// Why seed `ec_orders_v1` directly rather than checkout-then-assert:
//   1) Tests stay isolated from the checkout flow. A regression in
//      CheckoutPage shouldn't masquerade as a regression in AccountPage.
//   2) Multi-user-filter coverage (TC-ACCOUNT-002) is unreachable by
//      driving the UI: only one user is logged in per context, so we
//      can't generate another user's order through the form.
//   3) Seed-based tests run in <1s each; the full checkout flow is ~1.5s.
//
// Uses the chromium-auth project (storageState from auth.setup.ts) so
// the seeded user is test@example.com, matches userEmail filter.
import type { Page } from '@playwright/test';
import { test, expect } from './fixtures.ts';

// Contract type mirrored from the SUT (`src/types.ts`). Kept here instead
// of imported across repos so the test compile fails clearly when the
// SUT contract drifts; a missing field in the seed becomes a tsc error,
// not a runtime undefined that the test silently tolerates.
interface OrderItem {
  productId: string;
  slug: string;
  name: string;
  quantity: number;
  size: string | null;
  unitPrice: number;
  lineTotal: number;
}

interface Order {
  id: string;
  userEmail: string;
  placedAt: string;
  total: number;
  items: OrderItem[];
  shipping: {
    fullName: string;
    address1: string;
    address2: string;
    city: string;
    zip: string;
    country: string;
  };
}

const USER_EMAIL = 'test@example.com';

function buildOrder(overrides: Partial<Order> = {}): Order {
  return {
    id: 'NW-TEST-0001',
    userEmail: USER_EMAIL,
    placedAt: '2026-05-15T18:00:00.000Z',
    total: 33.99,
    items: [
      {
        productId: 'p-canvas-tote-bag',
        slug: 'canvas-tote-bag',
        name: 'Canvas Tote Bag',
        quantity: 1,
        size: null,
        unitPrice: 28.0,
        lineTotal: 28.0,
      },
    ],
    shipping: {
      fullName: 'Test Customer',
      address1: '1 Market Street',
      address2: '',
      city: 'Anytown',
      zip: '94105',
      country: 'United States',
    },
    ...overrides,
  };
}

async function seedOrders(page: Page, orders: Order[]): Promise<void> {
  // Visit a same-origin page first so localStorage is bound to the SUT
  // origin before we write to it. Without this step the writes happen
  // against `about:blank` and silently never reach the SUT.
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.evaluate((payload) => {
    window.localStorage.setItem('ec_orders_v1', JSON.stringify(payload));
  }, orders);
}

test.describe('Account / order history', () => {
  test('[TC-ACCOUNT-001] a placed order renders in history with id, item count, and total @P0', async ({
    page,
  }) => {
    const order = buildOrder({
      id: 'NW-TEST-A001',
      total: 33.99,
    });
    await seedOrders(page, [order]);

    await page.goto('/account', { waitUntil: 'domcontentloaded' });

    const row = page.getByTestId(`order-row-${order.id}`);
    await expect(row).toBeVisible();
    // The row renders three concrete user-visible pieces of data: the
    // order id (used as the heading), the item-count summary, and the
    // formatted currency total. Each is asserted on user-visible text
    // rather than the raw Order field so a render regression that drops
    // any one of them fails this test.
    await expect(row).toContainText(order.id);
    await expect(row).toContainText('1 item');
    await expect(row).toContainText('$33.99');

    // Empty-state should be absent when at least one order exists.
    await expect(page.getByTestId('order-history-empty')).toHaveCount(0);
  });

  test('[TC-ACCOUNT-002] other users\u2019 orders do not appear in history @P0', async ({
    page,
  }) => {
    const mine = buildOrder({ id: 'NW-MINE-001', userEmail: USER_EMAIL });
    const someoneElse = buildOrder({
      id: 'NW-NOTMINE-001',
      userEmail: 'other-user@example.com',
    });

    await seedOrders(page, [mine, someoneElse]);

    await page.goto('/account', { waitUntil: 'domcontentloaded' });

    // The user-visible contract: my order is listed, the other user's is
    // not. AccountPage does `orders.filter(o => o.userEmail === user?.email)`
    //, if that filter regresses (e.g. an early return that returns all
    // orders), the second assertion catches it. Without this test the
    // regression would ship green.
    await expect(page.getByTestId(`order-row-${mine.id}`)).toBeVisible();
    await expect(page.getByTestId(`order-row-${someoneElse.id}`)).toHaveCount(0);

    // Defence in depth: the order-history list should contain exactly one
    // row, not the two we seeded. Asserting count avoids the case where
    // the test passes because the other-user row is rendered with a
    // different testId scheme that getByTestId misses.
    const rows = page.getByTestId('order-history').getByRole('listitem');
    await expect(rows).toHaveCount(1);
  });

  test('[TC-ACCOUNT-003] empty order history shows the placeholder and a link to /products @P1', async ({
    page,
  }) => {
    // Explicit empty seed, covers the case where ec_orders_v1 exists
    // but contains no orders for this user. (A missing key is covered by
    // the fallback path in `useLocalStorage`; this asserts the explicit
    // empty-array case too.)
    await seedOrders(page, []);

    await page.goto('/account', { waitUntil: 'domcontentloaded' });

    const empty = page.getByTestId('order-history-empty');
    await expect(empty).toBeVisible();
    await expect(empty).toContainText(/haven['\u2019]t placed any orders/i);

    // The placeholder includes a "Start shopping" link to /products.
    // Asserting on the href catches a regression that swaps the link
    // target (e.g. to / or to a checkout funnel).
    const startShopping = empty.getByRole('link', { name: /start shopping/i });
    await expect(startShopping).toHaveAttribute('href', '/products');
  });
});
