// This test deliberately uses the un-wrapped Playwright `test` so that
// goto isn't auto-dismissing the banner — this is the one place we want
// to see SP load before we drive its API.
import { test, expect } from '@playwright/test';

test('[TC-COOKIE-001] SecurePrivacy script loads and exposes a callable hide API @P1', async ({ page }) => {
  await page.goto('/');

  // Confirm the SUT actually references the SP script.
  const scripts = await page.evaluate(() =>
    Array.from(document.querySelectorAll('script[src]')).map((s) => (s as HTMLScriptElement).src),
  );
  expect(scripts.some((src) => src.includes('app.secureprivacy.ai'))).toBe(true);

  // The script attaches `window.sp` once it has executed. Waiting on the
  // API surface is the most stable signal the banner runtime is ready —
  // the banner DOM itself is rendered in an SP-owned iframe, so a
  // selector-based assertion would be tied to SP-internal markup.
  await page.waitForFunction(
    () => typeof (window as unknown as { sp?: { hideCookieBanner?: () => void } }).sp?.hideCookieBanner === 'function',
    undefined,
    { timeout: 8000 },
  );

  // SP attaches its API early but injects the banner DOM on a later tick.
  // Calling hideCookieBanner before that DOM exists throws a null-reference
  // error from inside SP's bundle, so poll until the call succeeds.
  await expect
    .poll(
      async () =>
        page.evaluate(() => {
          try {
            (window as unknown as { sp: { hideCookieBanner: () => void } }).sp.hideCookieBanner();
            return 'ok';
          } catch {
            return 'not-ready';
          }
        }),
      { timeout: 8000 },
    )
    .toBe('ok');

  // After dismissal the rest of the page should remain interactable.
  await page.getByTestId('hero-shop-cta').click();
  await expect(page).toHaveURL(/\/products$/);
});
