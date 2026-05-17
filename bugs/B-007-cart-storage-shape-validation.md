# B-007: `ec_cart_v1` shape validation is missing

**Severity:** P0 (cart loss class; same severity bracket as B-004).
**Discoverer:** TC-CART-009, the parameterised cart-fail-safe contract test.
**Surface:** Storefront, all routes. The cart hydrates on every page load.
**Filed:** 2026-05-16.

## Summary

When `localStorage.ec_cart_v1` parses successfully as JSON but produces an unexpected runtime shape (a string, an object with the wrong field types, etc.), the SUT does not fail safe. The reducer reads the malformed value, downstream code operates on it (e.g. calling `.map` on a string `items` field), and the page either crashes or renders broken cart UI on every navigation until the user clears localStorage by hand.

This is the same bug class as B-004 (corrupt `ec_promo_used_v1` is treated as fresh) but with a larger blast radius: the cart appears on every page, the promo widget only on `/cart` and `/checkout`. A user who hits this loses their cart and may also be unable to complete checkout.

## Reproduction

1. Open DevTools on `/` in a fresh browser context.
2. Run one of:
   - `localStorage.setItem('ec_cart_v1', '"hello"')`, JSON-valid string, wrong root shape
   - `localStorage.setItem('ec_cart_v1', '{"items":"oops"}')`, object root, wrong `items` shape
3. Reload `/cart`.

Observed: The empty-state placeholder (`data-testid="cart-empty"`) does not render. Depending on the corruption shape, the page may bail to React's default error UI, render a partial cart, or hang.

Expected: The empty-state placeholder renders. The cart silently recovers, the same way it does when the JSON itself is malformed (`{not-json`).

A third shape, `{not-json` (invalid JSON), already fail-safes correctly because `JSON.parse` throws inside the existing try/catch in `readFromStorage`. Only the shape-mismatch path is exposed.

## Root cause

`src/hooks/useLocalStorage.ts`, `readFromStorage`:

```typescript
export function readFromStorage<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(key);
    if (raw === null) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}
```

The try/catch only protects against `JSON.parse` throwing. If parse succeeds and returns a value of the wrong runtime shape, the cast `as T` silently lies to the caller; the reducer then operates on the malformed value.

## Suggested fix

Add a validator argument to `readFromStorage` and use it from `usePersistedReducer`. A minimal shape:

```typescript
export function readFromStorage<T>(
  key: string,
  fallback: T,
  isValid: (value: unknown) => value is T = () => true,
): T {
  try {
    const raw = window.localStorage.getItem(key);
    if (raw === null) return fallback;
    const parsed = JSON.parse(raw);
    return isValid(parsed) ? parsed : fallback;
  } catch {
    return fallback;
  }
}
```

`CartContext` then passes a guard like:

```typescript
const isCartState = (v: unknown): v is CartState =>
  typeof v === 'object' && v !== null &&
  Array.isArray((v as CartState).items);
```

This pattern composes for every persisted store (cart, orders, promo lock) and keeps the validation co-located with the type definition rather than scattered in defensive code at every read site.

## Regression test

`tests/cart.spec.ts` → `[TC-CART-009] cart fail-safe: …` (three parameterised cases).

The two failing cases are marked `test.fail()` against this bug. When shape validation lands and the storefront empty-state renders for malformed shapes, both flip green automatically; the `test.fail` flag should be removed in the same PR that lands the SUT fix.

## Related

- **B-004**: same bug class on `ec_promo_used_v1` (corrupt promo storage treated as fresh). Both bugs share a root cause: persisted-storage reads do shape-aware casts without shape-aware validation. A fix for either bug should generalise into the helper change above so the next persisted store (orders, auth, future) gets the validation for free.
