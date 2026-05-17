# Test strategy

Companion to `DECISIONS.md`. That doc explains what the suite does and why; this one is the test-design contract: how I decide what's in the suite, what stays out, and what each priority tier promises.

## Operating principles

1. **Reliability before coverage.** A suite that goes red one day in five is worse than a smaller suite that only goes red when something is actually broken. We accept a coverage gap before we accept a flake.
2. **Failure should localise.** A failing test should tell you what broke and where, not "something in checkout." Field-level assertions over form-level. Specific selectors over screenshot diffs.
3. **Every test answers "what real-world failure does this catch?"** If the answer is hand-wavy, the test isn't pulling weight. The add/cut heuristic below makes this concrete.

## Risk tier framework

The `@P0`, `@P1`, `@P2` tags on every test name aren't decoration. They commit the suite to a concrete promise about what each tier guarantees.

| Tag | Bar to pass | What "miss" means | Examples |
| --- | --- | --- | --- |
| `@P0` | Must be green to release. Blocking. | A customer-facing functional break: can't buy, can't log in, money math wrong, cart loss. | `TC-CART-001`, `TC-CHECKOUT-001`, `TC-CART-009` (cart fail-safe), `TC-PROMO-001`, `TC-AUTH-001`, `TC-CART-008` (anon checkout redirect) |
| `@P1` | Should be green to release. Non-blocking if a P0 hotfix is rolling and the P1 has a noted workaround. | A degraded experience but the funnel still works. Form-validation errors, secondary navigations, a11y violations, drawer mechanics. | `TC-AUTH-005`, `TC-PROMO-003`, `TC-A11Y-001/002/003`, `TC-COOKIE-001` |
| `@P2` | Nice to have. Flagged for follow-up if red, doesn't block. | A polish or convenience-feature miss. Sort modes, search UX, edge-case rendering. | `TC-LIST-004`, `TC-LIST-005` |

The tag is a commitment, not a guess. Two-thirds of the suite is `@P0` or `@P1` by design: a small suite should aim at the throat, not at the long tail.

## Add/cut decision heuristic

Before writing a new test, answer all three questions concretely. If any answer is hand-wavy, the test isn't ready.

1. **What real-world failure does it catch?** Name a specific regression class: "SUT swaps `===` for a normalised-string check that drops `toUpperCase`", "AccountPage loses its `userEmail` filter", "fail-safe path locks the store into read-only mode". If the answer is "make sure the page loads", the existing route smoke test already covers that.
2. **Would the existing suite catch this failure?** Grep the spec files for the locator or behaviour first. If yes, the new test is redundant unless it improves localisation (the existing test's failure message wouldn't tell the on-call which line broke).
3. **Is there a falsifying assertion?** The test must end with at least one assertion whose negation describes the failure mode named in step 1. `expect(badge).toBeVisible()` doesn't falsify a logic bug; `expect(rows).toHaveCount(1)` after seeding two users' orders does.

Cut a test when any one of these is true: it has no assertion that maps back to a named failure mode; it duplicates a stronger assertion elsewhere; it has been quarantined (`test.fixme`) for more than a week without a fix landing.

## Outside this brief

What the suite intentionally doesn't include, and the trigger that would change that:

- **Visual regression.** Cart drawer animation timing plus dynamic order IDs make snapshot diffs brittle without more masking work than this is worth right now. Add when animation timing stabilises and there's a brand reason for pixel checks.
- **API contract testing.** The SUT has no real backend; everything's `localStorage`. Add when a backend lands.
- **Mobile viewport / cross-browser.** The brief asks for reliability on a small suite. Add when real analytics show non-Chromium traffic above about 5%.
- **Property-based testing.** The promo invariant assertion (`afterPromoTotal <= beforePromoTotal`) is already invariant-shaped; full property-based testing would multiply this without proportional signal until there are five or more pricing rules.
