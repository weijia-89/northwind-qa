# B-004: Trivial localStorage tampering re-enables `WELCOME10`

The "already used" guard reads `ec_promo_used_v1` and only honours an `Array.isArray(used)` value. Any other shape is silently accepted: the guard skips, the spread `[...(Array.isArray(used) ? used : []), PROMO_CODE]` resets the record back to a clean single-entry list, and the user gets to redeem `WELCOME10` again.

```ts
const used = readFromStorage<string[]>(PROMO_USED_KEY, []);
if (Array.isArray(used) && used.includes(PROMO_CODE)) {
  return { ok: false, error: 'Code already used this session' };
}
writeToStorage(PROMO_USED_KEY, [...(Array.isArray(used) ? used : []), PROMO_CODE]);
```

If the stored value is corrupted to `{}` or `null`, neither branch detects misuse.

## Reproduction

1. Apply `WELCOME10` on any cart. Reuse is now blocked (per B-002).
2. Open DevTools → Application → Local Storage → set `ec_promo_used_v1` to `{}`.
3. Re-apply `WELCOME10`. Discount succeeds.

## Expected Behaviour

Storage shape should be validated; corrupt values should be treated as "in use" (fail-safe), not "fresh" (fail-open).

## Suggested Fix

```ts
const raw = readFromStorage<unknown>(PROMO_USED_KEY, []);
const used = Array.isArray(raw) && raw.every((s): s is string => typeof s === 'string')
  ? raw
  : null;

// Fail safe: if storage is corrupt, refuse the promo.
if (used === null) return { ok: false, error: 'Could not verify promo eligibility' };
if (used.includes(PROMO_CODE)) return { ok: false, error: 'Code already used' };
writeToStorage(PROMO_USED_KEY, [...used, PROMO_CODE]);
```

## Notes

This is a low-severity bug because the demo has no real economic stakes (single user, static catalog, no payments). For the same logic in production, fail-safe shape validation is mandatory.

## Test Coverage

`tests/promo.spec.ts` → `[TC-PROMO-006]` applies `WELCOME10`, removes it, overwrites `ec_promo_used_v1` with `'{}'` via `page.evaluate`, and re-applies. The test asserts that a corrupt-shape storage value should be treated as in-use (`promoError` visible, `promoApplied` absent). Marked `test.fail()` today because the SUT fail-opens; flips green when shape validation lands.
