# B-002: Promo "session" guard is permanent across sessions

`applyPromo` rejects reuse with the error `"Code already used this session"`. The "session" framing is incorrect: the guard reads/writes `localStorage` key `ec_promo_used_v1`, which persists indefinitely and across logout. Once a user redeems `WELCOME10`, they can never use it again on that browser.

## Reproduction

1. Add any product to the cart.
2. Apply `WELCOME10`, discount succeeds.
3. Remove the promo.
4. Click "Logout".
5. Log back in (or stay logged out, promo is anonymous).
6. Apply `WELCOME10` again.
7. **Observed:** `Code already used this session`. Discount is denied even after logout, after closing the tab, after rebooting the machine.
8. **Expected:** "Session" implies the lifetime of the current browser session (sessionStorage), or a per-account lifetime entry. Either is fine; what's there is neither.

## Expected Behaviour

Pick one and document it:

- **Per-session:** move the key to `sessionStorage`, message stays accurate.
- **Per-account, lifetime:** key off the authenticated user, message becomes `"You've already used WELCOME10"`.
- **Per-order:** allow reuse across orders; this is the most common storefront semantic.

## Suggested Fix

```ts
// Option A: session-scoped (matches the current message)
const used = window.sessionStorage.getItem(PROMO_USED_KEY);
if (used === PROMO_CODE) return { ok: false, error: 'Code already used this session' };
window.sessionStorage.setItem(PROMO_USED_KEY, PROMO_CODE);
```

## Test Coverage

`tests/promo.spec.ts` → `[TC-PROMO-005]` asserts the *correct* contract (re-applying `WELCOME10` after remove + reload should succeed) and is marked `test.fail()` today. When the SUT switches to per-session or per-order semantics, the test flips green automatically, no edit required.
