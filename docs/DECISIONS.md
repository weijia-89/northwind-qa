# Design decisions

Short rationales for the non-obvious choices in this suite. One bullet per decision, framed as "we chose X over Y because Z."

## Suite topology

- **Single Chromium project for anon + a second project for auth checkout** over a single project with per-test login. Reason: the brief asks for "no flaky tests" and Playwright's storage-state pattern eliminates 3 redundant logins per checkout run, cutting both runtime and surface area for flake.
- **Setup project produces `.auth/user.json`** over running the login inline in `beforeAll`. Reason: setup runs once, the auth project depends on it, and the file is gitignored — no shared mutable state, no order-dependence between checkout tests.
- **No mobile-viewport project / no cross-browser project.** Reason: brief asks for reliability + a small well-crafted suite. Cross-browser and mobile add CI cost and surface area without much new signal for an SPA at this scope.

## Locators

- **Role / label / text > testId > CSS** as encoded in `lib/locators.ts`. Reason: roles and labels are the user-facing contract; testIds are an implementation detail. Where a testId is necessary (e.g. the promo input has no role/label, only a placeholder), the locator file documents *why* inline.
- **`cartLineList` helper** scopes any cart-line assertion to the page list, not the drawer. Reason: `CartDrawer` mounts on every page with the same `cart-line-*` testIds; Playwright strict mode would fail on the duplicates. One helper, one place to remember.

## Async + third-party

- **`waitForFunction`-based poll for SecurePrivacy** over a fixed `setTimeout` or selector wait. Reason: SP attaches `window.sp` early but injects its banner DOM on a later tick. Calling `hideCookieBanner()` too soon throws a null reference. Polling on a no-throw call is the only stable signal "SP is ready."
- **Fixture wraps `goto` and `reload`** (not just `goto`). Reason: a reload re-injects the banner.
- **Soft-fail the dismiss if SP is offline** (3s timeout, swallowed). Reason: SP isn't part of any assertion; if the script is blocked, tests should still run.
- **One dedicated `cookie-consent.spec.ts`** uses the un-wrapped Playwright `test` to verify SP actually loads. Reason: the rest of the suite trusts SP via the fixture; this test removes the abstraction so a broken script doesn't pass silently.

## Bug regression strategy

- **`test.fail()` for B-002, B-003, and B-004** over deleting the test, skipping with `test.skip`, or weakening the assertion to match the buggy behaviour. Reason: `test.fail` asserts the *correct* contract, lets Playwright report today's failure as expected, and flips the test green automatically when the SUT is fixed. Catches regressions in both directions.
- **a11y `KNOWN_ISSUES` allowlist for B-006** over `test.fail` on the whole a11y run or an inline `expect.toBe(violation.length, 1)`. Reason: the allowlist is keyed on rule ID + target substring, so fixing the contrast and removing the offending CSS class auto-disables the entry. Same flip-green pattern, scoped to one rule.
- **B-001 documented only**, no failing test. Reason: reproduction needs `stockCount=0 / inStock=true` data, which lives in the SUT's `src/data/products.ts` and isn't reachable from the test harness without a route-level mutation hook. Worth filing; not worth a brittle workaround.

## Assertion shape

- **`TC-CHECKOUT-001` asserts the `localStorage` shape** of the persisted order (userEmail, shipping, items[].slug, cleared cart) over a URL check alone. Reason: the SUT has no real backend, so localStorage *is* the data contract. URL + toast prove the UI ran; localStorage proves the order persisted.
- **`TC-PROMO-004` asserts an invariant** (`afterPromoTotal <= beforePromoTotal`) over a hardcoded `$52.79` check. Reason: an invariant survives unrelated SUT pricing changes (the test data here is small but the principle scales).
- **`TC-AUTH-005` asserts on `register-confirm-error`** (the field-level error) over the form-level banner. Reason: field-level pinpoints which field broke, which is what the user-facing error model actually communicates.

## CI

- **Read-only deploy key for the SUT clone** over a fine-grained PAT. Reason: the deploy key registration binds the key to one specific repo, and GitHub enforces the read-only flag at the key level rather than at the token-permissions level. No expiration to rotate either. A fine-grained PAT would also work, but for a long-lived CI wiring the deploy key has fewer ways to misconfigure. The default `GITHUB_TOKEN` is not an option for a private SUT because GitHub scopes that token to the workflow's own repo. Setup in [`SETUP.md`](SETUP.md#ci-on-github).
- **Workflow fails loudly at preflight when `SUT_REPO` is unset.** Reason: a missing variable should fail with a clear setup hint. Not silently try to clone a placeholder repo, or burn 90 seconds of CI minutes installing dependencies before noticing.

## What we cut

- **No visual regression snapshots.** Reason: the cart drawer's `transitionend` state machine and dynamic order IDs make snapshot diffs brittle without more masking work than this is worth in the 1–2h budget.
- **No `/account` order-history test.** Reason: would extend checkout coverage by ~2 tests with marginal new signal; the persistence is already proven in `TC-CHECKOUT-001` via the localStorage shape.
- **No broader axe sweep across routes.** Reason: drive-by violations on other routes aren't part of the brief; a per-route a11y suite belongs in a dedicated harness.

## What we'd add next

- `test.fail` for B-005's button-label fix once the SUT adopts the recommended change (sketched in `bugs/B-005-checkout-redirect-ux.md`).
- B-001 regression test once the SUT exposes a stable "create test product" hook or fixture seed mechanism.
- `/account` order-history assertion if the route grows more behaviour beyond listing.
- Promo helpers extracted to `lib/helpers.ts` if numeric `dollars()`-style parsing creeps into more specs.
