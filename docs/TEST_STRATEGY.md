# Test strategy

A short companion to `DECISIONS.md`. That doc explains what the suite does and why; this one answers the team-facing question that a take-home brief doesn't ask but a follow-up interview might: if this suite were owned by a team that wasn't me, what would change?

> Written against the current suite (50 application tests + 1 setup). Will need rework if the suite grows past about 150 tests or absorbs a second domain.

## Operating principles

1. Reliability before coverage. A suite that goes red one day in five is worse than a smaller suite that only goes red when something is actually broken. We accept a coverage gap before we accept a flake.
2. Failure should localize. A failing test should tell you what broke and where, not "something in checkout." Field-level assertions over form-level. Specific selectors over screenshot diffs.
3. Bugs become tests. Every confirmed bug ships with a `test.fail()` regression guard or an a11y allowlist entry that auto-flips green when the SUT is fixed. The pattern is in `DECISIONS.md` under "Bug regression strategy."
4. Trust the test, suspect the SUT. When CI goes red on `main`, the default hypothesis is that the application changed, not that the test got flaky. Inverting that default is how teams end up with a green suite that doesn't catch real regressions.
5. Every test answers "what real-world failure does this catch?" If the answer is "nothing concrete", the test isn't pulling weight and should be deleted. See the add/cut heuristic below.

## Risk tier framework

The `@P0`, `@P1`, `@P2` tags on every test name aren't decoration. They commit the suite to a concrete promise about what each tier guarantees.

| Tag | Bar to pass | What "miss" means | Examples |
| --- | --- | --- | --- |
| `@P0` | Must be green to release. Blocking. | A P0 regression is a customer-facing functional break: can't buy, can't log in, money math wrong, cart loss. | `TC-CART-001` (add to cart), `TC-CHECKOUT-001` (place order), `TC-CART-009` (cart fail-safe on corrupt storage), `TC-PROMO-001` (math), `TC-AUTH-001` (login), `TC-CART-008` (anon checkout redirect) |
| `@P1` | Should be green to release. Non-blocking if a P0 hotfix is rolling and the P1 has a noted workaround. | A P1 regression degrades the experience but doesn't break the funnel. Most form-validation errors, secondary navigations, a11y violations, drawer mechanics. | `TC-AUTH-005` (mismatched-password field error), `TC-PROMO-003` (remove restores total), `TC-A11Y-001/002/003` (a11y sweeps), `TC-COOKIE-001` (third-party banner) |
| `@P2` | Nice to have. Can be flagged for follow-up if red without blocking. | A P2 regression is a polish or convenience-feature miss. Sort modes, search UX, edge-case rendering. | `TC-LIST-004` (empty-search placeholder), `TC-LIST-005` (sort price-asc) |

The tag is a commitment, not a guess. Two-thirds of the suite is `@P0` or `@P1` by design: this is a small suite, so it should aim at the throat, not at the long tail.

## Add/cut decision heuristic

Before writing a new test, answer all three questions concretely. If any answer is hand-wavy, the test isn't ready.

1. **What real-world failure does it catch?** Name a specific regression class: "SUT swaps `===` for `===` on a normalised string", "AccountPage.tsx loses its `userEmail` filter", "fail-safe path locks the store into read-only mode". If the answer is "make sure the page loads", the existing route smoke test already covers that.
2. **Would the existing suite catch this failure?** Grep the spec files for the locator or behaviour first. If yes, the new test is redundant unless it improves localization (the existing test's failure message wouldn't tell the on-call which line broke).
3. **Is there a falsifying assertion?** The test must end with at least one assertion whose negation describes the failure mode named in step 1. "`expect(badge).toBeVisible()`" doesn't falsify a logic bug; "`expect(rows).toHaveCount(1)` after seeding two users' orders" does.

Cut a test when any one of these is true: it has no assertion that maps back to a named failure mode; it duplicates a stronger assertion elsewhere; it has been quarantined (`test.fixme`) for more than a week without a fix landing.

## Scaling assumptions

The suite as written is sized for one to three contributors. At about five contributors or 150 tests, three things break:

1. Worker count needs to go from 2 to 4 in CI; without that, runtime drifts past the 90-second budget that PR review can absorb.
2. The flat layout under `tests/` stops being navigable. Domain folders (`tests/checkout/`, `tests/promo/`, etc.) become worth the import friction.
3. Ownership has to become explicit. A `CODEOWNERS` file mapping spec files to GitHub-team reviewers, plus a "primary owner per domain" agreement, is the minimum.

The current solo-owner setup is fine and shouldn't pretend otherwise. If a hiring manager asks "how would this scale," the answer above is what changes; not "we'd add a SaaS observability dashboard."

## Flake budget

Definition: a flake is a test that passed on retry but failed on first attempt, on `main`, in the last seven days.

Targets when this suite is operationalized:

- Test-level flake rate under 0.5%
- First-attempt CI green rate above 95% on PRs
- Retry config stays at `retries: process.env.CI ? 1 : 0`. Raising to 2 would mask root causes; if a test only passes on retry 2, it's broken.

Quarantine rule: a flagged test gets `test.fixme()` plus a tracking issue with a one-week SLA. After one week with no fix, the test is deleted and the bug it covered goes back in the backlog. The suite never carries dead `test.fixme` permanently.

This is calibrated for a real team. As a single owner, the same rules apply with shorter feedback loops; the only difference is that "tracking issue" might be a TODO comment with a date.

## Outside this brief

What the suite intentionally doesn't include, and the trigger that would change that:

- Visual regression. Cart drawer animation timing plus dynamic order IDs make snapshot diffs brittle without more masking work than this is worth right now. Add when animation timing stabilizes and there's a brand reason for pixel checks.
- API contract testing. The SUT has no real backend; everything's localStorage. Add when a backend lands.
- Mobile viewport / cross-browser. The brief asks for reliability on a small suite. Add when real analytics show non-Chromium traffic above about 5%.
- Property-based testing. The promo invariant assertion (`afterPromoTotal <= beforePromoTotal`) is already invariant-shaped; full property-based testing would multiply this without proportional signal until there are five or more pricing rules.

## Open questions

If this suite were operated by a real team, these answers would need to exist before the second contributor lands. Each has a concrete trigger condition that converts it from "good to know" to "blocking."

| Question | Trigger to answer | Default until then |
| --- | --- | --- |
| Where do flake metrics report? | Suite passes 100 tests OR a second contributor joins. | GitHub Actions summary + manual scrape on the first red `main`. |
| Who owns the SUT, and what's the bridge when `main` is red because of upstream? | SUT is owned by a separate team. | Solo owner reads the upstream commit log to localise; no SLA. |
| On-call shape for `main`-red incidents? | A shared on-call rotation exists in the org. | "Whoever pushed last" or "Wei" until rotation defined. |
| Quarantine review cadence? | First `test.fixme` lands. | Inline TODO + date; no calendar event. |
| Promotion criteria for `test.fail` → live? | A SUT fix lands on `main` and Playwright auto-flips the test to passing. | Same PR that lands the SUT fix removes the `test.fail` flag and updates `bugs/B-XXX.md`. |

These don't need answers for the take-home. They need answers before two engineers share this suite. The point of writing them down now is so the answer-setting work is one-shot when the trigger fires, not "discovered in production" the first time `main` goes red.

