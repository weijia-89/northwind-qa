import { test as base, expect, type Page } from '@playwright/test';

type SpApi = {
  hideCookieBanner?: () => void;
  cookieBannerVisible?: () => boolean;
};

// Dismiss the SecurePrivacy cookie banner. Per the SP JS API reference
// (support.secureprivacy.ai), `sp_init` fires when `window.sp` is ready;
// `hideCookieBanner()` hides the banner; `cookieBannerVisible()` is the
// truth signal we assert on after the call.
//
// One race to handle: `sp_init` may have already fired before this
// listener subscribes (the script tag is in `index.html`, so it can be
// ready on first paint). We check `window.sp` up front to cover that.
//
// Soft-fail on SP outage: if the vendor script never loads, we log and
// continue so a broken third party doesn't surface as cryptic
// "element intercepted" errors elsewhere in the suite.
async function dismissCookieBanner(page: Page): Promise<void> {
  const BUDGET_MS = 3000;
  try {
    await page.evaluate((budget) => {
      return new Promise<void>((resolve, reject) => {
        const timer = setTimeout(
          () => reject(new Error('SP not ready within budget')),
          budget,
        );

        // Poll for readiness, then hide and verify. Polling covers both
        // (a) `sp_init` having already fired pre-subscription and
        // (b) the small render lag between `hideCookieBanner()` returning
        // and `cookieBannerVisible()` flipping to false.
        const poll = setInterval(() => {
          const sp = (window as unknown as { sp?: SpApi }).sp;
          if (!sp?.hideCookieBanner) return;
          sp.hideCookieBanner();
          if (sp.cookieBannerVisible?.()) return;
          clearInterval(poll);
          clearTimeout(timer);
          resolve();
        }, 50);
        // Clean up on timeout so we don't leak the interval.
        setTimeout(() => clearInterval(poll), budget);
      });
    }, BUDGET_MS);
  } catch {
    console.warn(
      '[fixtures] SecurePrivacy did not dismiss within %dms — continuing without it',
      BUDGET_MS,
    );
  }
}

export const test = base.extend({
  page: async ({ page }, use) => {
    // Block the picsum CDN so tests don't depend on its uptime. The SUT's
    // product images come from picsum and aren't part of any assertion.
    await page.route(/picsum\.photos/, (route) => route.abort());

    // Auto-dismiss the SecurePrivacy banner after every navigation so it
    // doesn't overlay clickable elements. Wrap both goto and reload —
    // reload re-injects the banner.
    const originalGoto = page.goto.bind(page);
    page.goto = (async (...args: Parameters<Page['goto']>) => {
      const response = await originalGoto(...args);
      await dismissCookieBanner(page);
      return response;
    }) as Page['goto'];

    const originalReload = page.reload.bind(page);
    page.reload = (async (...args: Parameters<Page['reload']>) => {
      const response = await originalReload(...args);
      await dismissCookieBanner(page);
      return response;
    }) as Page['reload'];

    await use(page);
  },
});

export { expect };
