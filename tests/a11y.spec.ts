import AxeBuilder from '@axe-core/playwright';
import type { Result } from 'axe-core';
import { test, expect } from './fixtures.ts';
import { addToCartButton, productCardBySlug } from '../lib/locators.ts';

// Allowlist for known issues that already have a bug filed. Removing an
// entry once the SUT fixes the bug turns the test into a regression guard.
//
// Match on the failing node's outerHTML rather than CSS selector: Vite
// hashes CSS module class names, so `_logo_561gc_18` would drift on every
// rebuild. The brand text "Goods" is stable. Header renders on every
// route, so the entry covers / plus /products, /cart, /checkout.
const KNOWN_ISSUES: Array<{ ruleId: string; htmlIncludes: string; bug: string }> = [
  { ruleId: 'color-contrast', htmlIncludes: '>Goods<', bug: 'B-006' },
];

function isKnown(violation: Result): boolean {
  return KNOWN_ISSUES.some(
    (known) =>
      violation.id === known.ruleId &&
      violation.nodes.some((node) => node.html.includes(known.htmlIncludes)),
  );
}

// Shared assertion shape. Returns the blocking violations rather than
// asserting inline so each test can name the route in its failure
// message; otherwise four failing routes would all read "axe violations
// found" with no route context.
async function blockingViolations(page: import('@playwright/test').Page): Promise<Result[]> {
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
  return results.violations.filter(
    (v) => ['serious', 'critical'].includes(v.impact ?? '') && !isKnown(v),
  );
}

function formatViolations(violations: Result[]): string {
  // Compact one-line-per-violation summary so the failure message is
  // grep-able from CI logs without needing the trace artifact.
  return violations
    .map((v) => `${v.id} (${v.impact}) on ${v.nodes.length} node(s)`)
    .join('; ');
}

test('[TC-A11Y-001] no new critical/serious axe violations on / @P1', async ({ page }) => {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  const blocking = await blockingViolations(page);
  expect(blocking, `New axe violations on /: ${formatViolations(blocking)}`).toEqual([]);
});

// /products renders a filter group, a sort listbox, a search textbox, and
// a grid of cards. Each is a distinct ARIA structure that / doesn't have,
// so a regression here (e.g. unlabelled select, missing landmark) won't
// surface on TC-A11Y-001, it needs its own sweep.
test('[TC-A11Y-002] no new critical/serious axe violations on /products @P1', async ({ page }) => {
  await page.goto('/products', { waitUntil: 'domcontentloaded' });
  // Wait for the grid to render so the axe sweep covers loaded content,
  // not a loading skeleton with different semantics.
  await expect(page.getByTestId('product-grid')).toBeVisible();

  const blocking = await blockingViolations(page);
  expect(blocking, `New axe violations on /products: ${formatViolations(blocking)}`).toEqual([]);
});

// /cart with items renders the qty stepper (button group + live region
// for the total) and the promo input. These are common a11y trouble spots
//, qty buttons often ship without aria-label, totals without aria-live.
// Worth its own sweep.
test('[TC-A11Y-003] no new critical/serious axe violations on /cart with items @P1', async ({
  page,
}) => {
  await page.goto('/products', { waitUntil: 'domcontentloaded' });
  await addToCartButton(productCardBySlug(page, 'canvas-tote-bag')).click();
  await page.goto('/cart', { waitUntil: 'domcontentloaded' });
  // Anchor the axe sweep on a known cart-page element so a misroute
  // doesn't sweep the empty placeholder and pass spuriously.
  await expect(page.getByTestId('cart-line-list')).toBeVisible();

  const blocking = await blockingViolations(page);
  expect(blocking, `New axe violations on /cart: ${formatViolations(blocking)}`).toEqual([]);
});
