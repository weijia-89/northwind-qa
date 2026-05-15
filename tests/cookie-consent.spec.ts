// This test deliberately uses the un-wrapped Playwright `test` so the
// shared fixture isn't auto-dismissing the banner — this is the one
// place we want to drive SP's lifecycle ourselves and assert the
// vendor-promised contract holds.
//
// Per the SP JavaScript API reference:
//   - `sp_init` window event fires when SP is fully initialised.
//   - `sp.hideCookieBanner()` forces the banner to hide.
//   - `sp.cookieBannerVisible()` returns the current banner state.
//
// We verify all three: ready event fires, hide call lands, banner is
// actually hidden afterwards.
import { test, expect } from '@playwright/test';

type SpApi = {
  hideCookieBanner?: () => void;
  cookieBannerVisible?: () => boolean;
};

test('[TC-COOKIE-001] SecurePrivacy initialises, hide API is callable, and the banner is actually hidden @P1', async ({ page }) => {
  await page.goto('/');

  // 1) The SUT references the SP script tag.
  const scripts = await page.evaluate(() =>
    Array.from(document.querySelectorAll('script[src]')).map((s) => (s as HTMLScriptElement).src),
  );
  expect(scripts.some((src) => src.includes('app.secureprivacy.ai'))).toBe(true);

  // 2) Wait for the `sp_init` event — SP's documented "ready" signal —
  //    OR for `window.sp` to be present (whichever arrives first; on a
  //    cached load the event may have fired before we got here).
  await page.evaluate(() => {
    return new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('sp_init not seen within 10s')), 10_000);
      const done = () => { clearTimeout(timer); resolve(); };
      if ((window as unknown as { sp?: SpApi }).sp) return done();
      window.addEventListener('sp_init', done, { once: true });
      // Cheap parallel poll in case the event fired between script load
      // and this listener being attached.
      const poll = setInterval(() => {
        if ((window as unknown as { sp?: SpApi }).sp) {
          clearInterval(poll);
          done();
        }
      }, 100);
    });
  });

  // 3) API surface contract — both methods we depend on are bound.
  const apiShape = await page.evaluate(() => {
    const sp = (window as unknown as { sp?: SpApi }).sp;
    return {
      hide: typeof sp?.hideCookieBanner,
      visible: typeof sp?.cookieBannerVisible,
    };
  });
  expect(apiShape.hide).toBe('function');
  // `cookieBannerVisible` is part of the documented API. If it stops
  // being exposed in a future SP bundle, this assertion will catch it
  // and force a fixture re-think rather than letting the dismiss silently
  // stop verifying its own outcome.
  expect(apiShape.visible).toBe('function');

  // 4) Behaviour check — call hide, then assert the banner reports as
  //    hidden. A regression that makes `hideCookieBanner` a no-op (still
  //    callable, doesn't throw, doesn't hide) would slip past a binding
  //    check; it can't slip past this one.
  await expect
    .poll(
      async () =>
        page.evaluate(() => {
          const sp = (window as unknown as { sp: SpApi }).sp;
          try {
            sp.hideCookieBanner!();
          } catch {
            return 'threw';
          }
          return sp.cookieBannerVisible!() ? 'still-visible' : 'hidden';
        }),
      { timeout: 5000, message: 'banner should be hidden after hideCookieBanner() call' },
    )
    .toBe('hidden');

  // 5) After dismissal the rest of the page should remain interactable.
  await page.getByTestId('hero-shop-cta').click();
  await expect(page).toHaveURL(/\/products$/);
});
