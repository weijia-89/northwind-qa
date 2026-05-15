import { test, expect } from './fixtures.ts';
import {
  categoryChip,
  productCardBySlug,
  searchInput,
  sortSelect,
} from '../lib/locators.ts';

test.describe('Product list', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/products', { waitUntil: 'domcontentloaded' });
  });

  test('[TC-LIST-001] Default view shows all 16 products @P1', async ({ page }) => {
    await expect(page.getByTestId('product-grid')).toBeVisible();
    await expect(page.getByTestId('result-count')).toContainText('16');
  });

  test('[TC-LIST-002] Category filter (Accessories) narrows results and updates URL @P1', async ({ page }) => {
    await categoryChip(page, 'Accessories').click();

    await expect(page).toHaveURL(/[?&]category=accessories/);
    await expect(page.getByTestId('result-count')).toContainText('4');

    await expect(productCardBySlug(page, 'classic-white-tee-mens')).toHaveCount(0);
    await expect(productCardBySlug(page, 'canvas-tote-bag')).toBeVisible();
  });

  test('[TC-LIST-003] Search by name narrows the grid @P1', async ({ page }) => {
    await searchInput(page).fill('cashmere');

    // Search input is debounced; auto-wait on result-count handles the delay.
    await expect(page.getByTestId('result-count')).toContainText('1');
    await expect(productCardBySlug(page, 'cashmere-cardigan')).toBeVisible();
  });

  test('[TC-LIST-004] Empty search result renders product-grid-empty @P2', async ({ page }) => {
    await searchInput(page).fill('zzznotaproductname');

    await expect(page.getByTestId('result-count')).toContainText('0');
    await expect(page.getByTestId('product-grid-empty')).toBeVisible();
  });

  test('[TC-LIST-005] Sort price-asc puts the cheapest product first @P2', async ({ page }) => {
    await sortSelect(page).selectOption('price-asc');

    // Two products tie at $22 (men's + women's white tee); regex accepts
    // either since the tie-break order between them isn't contractual.
    const firstCard = page.getByTestId('product-grid').locator('> *').first();
    await expect(firstCard).toHaveAttribute(
      'data-testid',
      /product-card-classic-white-tee-/,
    );
  });
});
