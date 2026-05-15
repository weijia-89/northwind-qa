import { test as base, expect, type Page } from '@playwright/test';

type SpApi = {
  hideCookieBanner?: () => void;
  cookieBannerVisible?: () => boolean;
};

// Dismiss the SecurePrivacy cookie banner using the vendor's documented
// lifecycle:
//
//   1. Wait for the `sp_init` window event. Per the SP JavaScript API
//      reference (support.secureprivacy.ai), this is the official signal
//      that the `sp` object is ready. Fall back to polling for `window.sp`
//      in case the listener was registered after the event fired.
//   2. Call `sp.hideCookieBanner()`.
//   3. Verify with `sp.cookieBannerVisible()` returning false — proving
//      the call actually hid the banner, not just that it didn't throw.
//
// If SP is offline / blocked / slow, the whole thing soft-fails after the
// 3s overall budget and a console.warn breadcrumb lands in the test log so
// a broken SP isn't silent in CI.
async function dismissCookieBanner(page: Page): Promise<void> {
  const BUDGET_MS = 3000;
  try {
    await page.evaluate((budget) => {
      return new Promise<void>((resolve, reject) => {
        const timer = setTimeout(
          () => reject(new Error('SP did not become ready within budget')),
          budget,
        );

        const tryDismiss = () => {
          const sp = (window as unknown as { sp?: SpApi }).sp;
          if (!sp || typeof sp.hideCookieBanner !== 'function') return false;
          try {
            sp.hideCookieBanner();
          } catch {
            // Banner DOM not injected yet; the caller will retry via the
            // listener path or the readiness poll.
            return false;
          }
          // If `cookieBannerVisible` is exposed, use it as the truth signal.
          // Older bundles might not have it; treat absence as "trust the call."
          if (typeof sp.cookieBannerVisible === 'function') {
            if (sp.cookieBannerVisible()) return false;
          }
          clearTimeout(timer);
          resolve();
          return true;
        };

        // 1) Try immediately — `sp_init` may have already fired before the
        //    fixture got a chance to subscribe.
        if (tryDismiss()) return;

        // 2) Subscribe to the official ready event.
        window.addEventListener(
          'sp_init',
          () => {
            // SP DOM injection happens shortly after `sp_init`; poll on a
            // microtask cadence rather than a fixed delay.
            const poll = setInterval(() => {
              if (tryDismiss()) clearInterval(poll);
            }, 50);
            setTimeout(() => clearInterval(poll), budget);
          },
          { once: true },
        );

        // 3) Belt-and-braces fallback: poll in case `sp_init` already fired
        //    before this listener was added (race on slow page boot).
        const fallback = setInterval(() => {
          if (tryDismiss()) clearInterval(fallback);
        }, 100);
        setTimeout(() => clearInterval(fallback), budget);
      });
    }, BUDGET_MS);
  } catch {
    // SP not ready / offline / blocked. Surface a breadcrumb so a broken
    // SP doesn't manifest only as cryptic "intercepted by another element"
    // errors in unrelated specs.
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
