import { test as base, expect, type Page } from '@playwright/test';

// Calls the SecurePrivacy API once it has attached to window. If the script
// is slow or unavailable, swallow the timeout — tests should still run.
async function dismissCookieBanner(page: Page): Promise<void> {
  try {
    // SP attaches its API early but injects the banner DOM on a later tick;
    // calling hideCookieBanner before that throws. waitForFunction retries
    // until the call returns cleanly, with a generous timeout that's still
    // a soft-fail if SP is offline.
    await page.waitForFunction(
      () => {
        const sp = (window as unknown as { sp?: { hideCookieBanner?: () => void } }).sp;
        if (typeof sp?.hideCookieBanner !== 'function') return false;
        try {
          sp.hideCookieBanner();
          return true;
        } catch {
          return false;
        }
      },
      undefined,
      { timeout: 3000 },
    );
  } catch {
    // SP not ready / offline / blocked. Tests still run.
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
