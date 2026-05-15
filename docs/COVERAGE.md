# Coverage

Per-test traceability for the 37 application tests (+1 `setup` project). The summary table in [`../README.md`](../README.md) is the high-level view; this file is the per-ID index a hostile reviewer can grep against the running suite.

## Test index

| ID | File | What it asserts |
| --- | --- | --- |
| `TC-HOME-001` | `home.spec.ts` | `/` renders hero, category tiles, featured grid |
| `TC-HOME-002` | `home.spec.ts` | Hero CTA navigates to `/products` and grid renders |
| `TC-LIST-001` | `product-list.spec.ts` | Default view shows all 16 products |
| `TC-LIST-002` | `product-list.spec.ts` | Category filter narrows results and updates URL |
| `TC-LIST-003` | `product-list.spec.ts` | Search by name narrows the grid |
| `TC-LIST-004` | `product-list.spec.ts` | Empty search renders `product-grid-empty` |
| `TC-LIST-005` | `product-list.spec.ts` | Sort price-asc puts the cheapest product first |
| `TC-PDP-001` | `product-detail.spec.ts` | Non-apparel PDP renders name, price, description, image |
| `TC-PDP-002` | `product-detail.spec.ts` | In-stock PDP shows enabled "Add to cart" after stock check |
| `TC-PDP-003` | `product-detail.spec.ts` | Out-of-stock PDP disables CTA with "Out of stock" |
| `TC-PDP-004` | `product-detail.spec.ts` | Apparel: size required, then size + qty 2 lands in cart |
| `TC-PDP-005` | `product-detail.spec.ts` | Unknown slug renders `product-detail-missing` placeholder |
| `TC-CART-001` | `cart.spec.ts` | Add to cart updates the badge |
| `TC-CART-002` | `cart.spec.ts` | Cart icon opens the drawer with the added line |
| `TC-CART-003` | `cart.spec.ts` | Cart persists across reload |
| `TC-CART-004` | `cart.spec.ts` | Increment qty updates badge, line total, cart total |
| `TC-CART-005` | `cart.spec.ts` | Remove the last line returns the cart to its empty state |
| `TC-CART-006` | `cart.spec.ts` | Removing one of two lines leaves the other intact |
| `TC-CART-007` | `cart.spec.ts` | Decrement qty reduces badge and line total |
| `TC-CART-008` | `cart.spec.ts` | Anonymous "Proceed to checkout" redirects to `/login` with `redirect=%2Fcheckout` |
| `TC-PROMO-001` | `promo.spec.ts` | `WELCOME10` applies 10% discount |
| `TC-PROMO-002` | `promo.spec.ts` | Invalid promo code surfaces an error |
| `TC-PROMO-003` | `promo.spec.ts` | Removing an applied promo restores the original total |
| `TC-PROMO-004` | `promo.spec.ts` | **`test.fail`** — valid promo must never raise the total (B-003) |
| `TC-PROMO-005` | `promo.spec.ts` | **`test.fail`** — `WELCOME10` reapplies after removal + reload (B-002) |
| `TC-PROMO-006` | `promo.spec.ts` | **`test.fail`** — corrupt `ec_promo_used_v1` shape must fail-safe (B-004) |
| `TC-AUTH-001` | `auth.spec.ts` | Seeded creds land on `/` + welcome toast |
| `TC-AUTH-002` | `auth.spec.ts` | Bad creds → inline error, stay on `/login` |
| `TC-AUTH-003` | `auth.spec.ts` | Register a new account → redirected to `/` |
| `TC-AUTH-005` | `auth.spec.ts` | Register: mismatched passwords show field-level error |
| `TC-AUTH-006` | `auth.spec.ts` | Register: duplicate email surfaces "already exists" error |
| `TC-AUTH-007` | `auth.spec.ts` | Login → logout → anonymous menu + protected-route guard re-armed |
| `TC-CHECKOUT-001` | `checkout.spec.ts` | Happy path: cart → checkout → place order → confirmation (incl. `localStorage` shape assertion) |
| `TC-CHECKOUT-002` | `checkout.spec.ts` | Empty cart shows `page-checkout-empty` instead of the form |
| `TC-CHECKOUT-003` | `checkout.spec.ts` | Place order with invalid card number is blocked with validation error |
| `TC-COOKIE-001` | `cookie-consent.spec.ts` | SecurePrivacy script loads and exposes a callable hide API |
| `TC-A11Y-001` | `a11y.spec.ts` | No new critical/serious axe violations on `/` |

## Bug → test mapping

| Bug | Coverage | Notes |
| --- | --- | --- |
| **B-001** stock reconcile race | Documented only | Reproduction needs `stockCount=0 / inStock=true` in `src/data/products.ts` — a SUT mutation outside the test suite's scope |
| **B-002** promo permanent lock | `TC-PROMO-005` (`test.fail`) | Asserts re-apply after removal + reload should succeed; today it errors with `Code already used this session` |
| **B-003** promo loses free shipping | `TC-PROMO-004` (`test.fail`) | Asserts the invariant: a valid promo never raises the total. Today's $52 cart goes from $52.00 → $52.79 with `WELCOME10`. |
| **B-004** localStorage tampering | `TC-PROMO-006` (`test.fail`) | Overwrites `ec_promo_used_v1` with `'{}'` via `page.evaluate` and re-applies `WELCOME10`. Asserts the SUT should fail-safe (reject corrupt shape) — today it fail-opens (resets the record and accepts the promo) |
| **B-005** anonymous checkout UX | `TC-CART-008` | Asserts the redirect behaviour + cart-survives. The UX recommendation (button label change) is documented in the bug report; the SUT-side fix is the contract change |
| **B-006** logo color contrast | `TC-A11Y-001` | Surfaced by axe; allowlisted via `KNOWN_ISSUES`. Removing the allowlist entry once the SUT fixes the contrast turns the test into a regression guard |

## Known gaps (intentional)

- **No `/account` order history assertion.** Once an order is placed it should appear there. Untested — extends checkout coverage by ~2 tests with marginal new signal.
- **No mobile-viewport project.** A single Chromium project keeps the suite fast and the surface small. The brief asks for reliability over breadth.
- **No cross-browser.** Firefox/WebKit add CI cost without much new signal for an SPA at this scope.
- **No visual regression.** The cart drawer's `transitionend` state machine and dynamic order IDs make snapshot diffs brittle without more masking work than this is worth in a 1–2h budget.
- **a11y check on `/` only.** Broader axe sweeps tend to surface drive-by violations that aren't part of the brief; a per-route sweep belongs in a dedicated a11y suite.
