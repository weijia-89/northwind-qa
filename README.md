# northwind-qa

Playwright E2E suite for the Northwind Goods storefront, a React 19 + Vite e-commerce SPA with no real backend (everything persists via `localStorage`).

## Quick start

```bash
npm install
npm test          # pretest hook installs the Chromium build, then runs the suite
npm run typecheck # tsc --noEmit; catches type errors before runtime
```

The SUT (Northwind Goods storefront) must be cloned alongside this repo as `../example-e-commerce-website` and have its dependencies installed, Playwright boots it via the `webServer` block in `playwright.config.ts`. Override the path with `E2E_SUT_DIR=/path/to/sut` if you keep it somewhere else. Full env-var list is in [`docs/SETUP.md`](docs/SETUP.md).

On Linux CI, `npm run install:browsers` (with `--with-deps`) is the way to also pull system libraries; the local `pretest` keeps it lean.

## What's covered

50 application tests + 1 auth setup. 45 pass outright; 5 are `test.fail()` regression guards (B-002, B-003, B-004, plus the two shape-failure cases of B-007) that flip green when the SUT is fixed. Whole suite runs in under 20 seconds locally (16–18s on a warm cache, slightly longer cold). Single Chromium project for anonymous flows + a second project for authenticated checkout and account that consumes storage state from `auth.setup.ts`.

| File | Tests | Covers |
| --- | --- | --- |
| `tests/auth.setup.ts` | 1 | One-shot login → `.auth/user.json` |
| `tests/home.spec.ts` | 2 | Hero, category tiles, featured grid, CTA navigation |
| `tests/product-list.spec.ts` | 5 | Default, category filter, search, empty state, sort |
| `tests/product-detail.spec.ts` | 5 | Render, in-stock, OOS, apparel size+qty, unknown slug |
| `tests/cart.spec.ts` | 11 | Add, drawer, persist, qty math, remove-last, remove-mid, anonymous-checkout redirect, fail-safe on 3 storage corruption shapes (B-007 `test.fail` x2) |
| `tests/promo.spec.ts` | 10 | `WELCOME10` math, invalid code, removal, case- and whitespace-insensitivity (4 variants), B-003 / B-002 / B-004 regression guards (`test.fail`) |
| `tests/auth.spec.ts` | 6 | Login ✓/✗, register ✓, register password-mismatch, register duplicate-email, logout |
| `tests/checkout.spec.ts` | 3 | Happy path (with localStorage shape assertion), empty cart, invalid card |
| `tests/account.spec.ts` | 3 | Order history rendering, multi-user filter, empty state |
| `tests/cookie-consent.spec.ts` | 1 | SecurePrivacy script loads + dismiss API works |
| `tests/a11y.spec.ts` | 3 | No new critical/serious axe violations on `/`, `/products`, `/cart` |

Per-test traceability and the bug-to-test mapping live in [`docs/COVERAGE.md`](docs/COVERAGE.md). The framework that decides which tier each test belongs to and when a new test deserves to exist lives in [`docs/TEST_STRATEGY.md`](docs/TEST_STRATEGY.md).

### Regression guards (`test.fail`)

Five tests covering four real bugs (B-002, B-003, B-004, B-007) are marked `test.fail()`, Playwright treats them as **expected** to fail today, so they don't break the suite, but they automatically flip green when each SUT fix lands. CI catches a regression in either direction.

## Cookie consent

The SUT loads `https://app.secureprivacy.ai/...` from `index.html`, which injects a banner near the bottom of the viewport. The shared fixture in [`tests/fixtures.ts`](tests/fixtures.ts) runs a dismiss sequence after every navigation. It subscribes to the documented `sp_init` event, calls `sp.hideCookieBanner()`, then verifies `sp.cookieBannerVisible()` returns `false` before the next assertion runs.

`cookie-consent.spec.ts` (TC-COOKIE-001) verifies the full lifecycle once. SP's script tag loads. The `sp_init` event fires. Both `hideCookieBanner` and `cookieBannerVisible` are bound on `window.sp`. A `hideCookieBanner()` call drives `cookieBannerVisible()` to return `false` inside a 5s poll budget. An earlier version of this test only asserted the hide method was a function. A broken-but-bound API would have shipped green there.

If SecurePrivacy is offline or slow, the dismiss soft-fails (3s budget, swallowed with a console warning) and the suite continues. The SUT's own logic doesn't gate on consent.

## Bugs found in the SUT

7 bug reports under [`bugs/`](bugs/) with reproduction steps and a suggested fix.

| | Summary | Regression test |
| --- | --- | --- |
| [B-001](bugs/B-001-stock-reconcile-race.md) | `addItem` allows transient out-of-stock state via 150ms reconcile race; quantity overflow unchecked | Needs SUT data mutation; documented only |
| [B-002](bugs/B-002-promo-permanently-locked.md) | Promo "session" guard is `localStorage`-permanent across sessions | `TC-PROMO-005` (`test.fail`) |
| [B-003](bugs/B-003-promo-discount-loses-free-shipping.md) | Applying `WELCOME10` to a near-threshold cart can *increase* the total | `TC-PROMO-004` (`test.fail`) |
| [B-004](bugs/B-004-promo-localstorage-tampering.md) | Trivial `localStorage` tampering re-enables `WELCOME10` | `TC-PROMO-006` (`test.fail`) |
| [B-005](bugs/B-005-checkout-redirect-ux.md) | Anonymous "Proceed to checkout" silently redirects to `/login` with no warning | `TC-CART-008` asserts the redirect |
| [B-006](bugs/B-006-logo-color-contrast.md) | Header logo "Goods" fails WCAG 2 AA contrast (1.66:1, needs 3:1) | `TC-A11Y-001` via `KNOWN_ISSUES` allowlist |
| [B-007](bugs/B-007-cart-storage-shape-validation.md) | `ec_cart_v1` is read back with `as T` but no runtime shape check; non-array `items` or non-object root crashes the cart on every page load | `TC-CART-009` (`test.fail` x2 for the two failing shapes; the invalid-JSON case passes) |

## Design notes

The short rationale for each non-obvious choice lives in [`docs/DECISIONS.md`](docs/DECISIONS.md); the bullets below are the headline summary.


- **Locator priority:** role / label / text > testId > CSS, centralised in [`lib/locators.ts`](lib/locators.ts). `getByTestId` is reserved for elements without a useful role or label (the promo input, the cart-badge, internal cart-line testIds).
- **No `waitForTimeout` or `networkidle`.** Auto-waiting actions and `expect.toBe*` assertions only.
- **Test isolation via fresh `BrowserContext`** (Playwright default). No shared state between tests; `localStorage` starts empty unless the test seeds it.
- **`test.fail()` for known-broken behaviour** is preferred over deleting/skipping the test or weakening the assertion. The test stays in the suite, asserts the *correct* contract, and flips green automatically when the SUT is fixed, so CI catches both a fresh regression *and* an unannounced fix.
- **`@axe-core/playwright`** runs on `/` only. Known violations are pinned by rule + target substring in `KNOWN_ISSUES`; removing an entry once the SUT is fixed turns the test into a regression guard.
- **CI:** [`.github/workflows/playwright.yml`](.github/workflows/playwright.yml) clones the SUT, installs browsers with `--with-deps`, runs the suite under `CI=true` (one retry, 2 workers), uploads the HTML report on failure. **Requires** repo variable `SUT_REPO` set to `owner/name` of the SUT (and optional `SUT_REF`, default `main`); the workflow fails loudly with a setup hint if `SUT_REPO` is unset. When the SUT repo is private, also set the `SUT_DEPLOY_KEY` secret to an ed25519 private key whose public half is registered as a **read-only deploy key** on the SUT repo. Full generate/install steps in [`docs/SETUP.md`](docs/SETUP.md).

## Repo layout

```
northwind-qa/
├── lib/
│   └── locators.ts
├── tests/
│   ├── fixtures.ts
│   ├── auth.setup.ts
│   ├── *.spec.ts
├── bugs/                       # 6 reports
├── docs/
│   ├── SETUP.md
│   ├── TEST_DATA.md
│   ├── COVERAGE.md
│   └── DECISIONS.md
├── playwright.config.ts
├── tsconfig.json
└── package.json
```
