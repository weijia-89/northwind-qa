# B-001 — Stock reconciliation race in `addItem` allows out-of-stock orders

`CartContext.addItem` dispatches an `ADD_ITEM` action immediately, then schedules a `setTimeout(..., 150)` that re-checks `product.stockCount === 0` and dispatches `REMOVE_ITEM` if so. Two failure modes follow:

1. **Inconsistent product state passes the gate.** A product with `inStock: true` but `stockCount: 0` (no invariant ties these together in the data) gets added, then removed 150ms later — but the user sees a "added to cart" toast first and an error toast second. Confusing UX, and any test/observer that samples in the 150ms window sees the cart in an invalid state.

2. **Quantity overflow.** The `addItem` reconcile only checks `stockCount === 0`, not `quantity > stockCount`. The detail page `QuantityStepper` lets the user add up to 99 of any in-stock item regardless of inventory. A user can add 10 of a 1-stock product with no error.

## Reproduction

### 2.1 Race window

1. In `src/data/products.ts`, mutate any product to `{ inStock: true, stockCount: 0 }` and reload.
2. Click "Add to cart" on that product card.
3. Observe: cart-badge shows "1", then ~150ms later the badge disappears and an error toast fires.
4. (Optional, for confirming the dispatch order rather than just the visible blink: open React DevTools → Profiler and record the click — you'll see `ADD_ITEM` followed by `REMOVE_ITEM` inside the same render commit.)
5. Expected: the button should be disabled, or the click should be a no-op with the error toast firing immediately. No transient success.

### 2.2 Quantity overflow

1. On the home page, navigate to "Cashmere Cardigan" (stockCount 4).
2. Use the quantity stepper to set quantity to 10.
3. Click "Add to cart".
4. Observe: 10 items added, no warning.
5. Expected: max quantity should be clamped at `stockCount`, with a UI note.

## Expected Behaviour

- `addItem` should consult `stockCount` synchronously and refuse the dispatch with a single error toast — no transient success.
- Quantity-aware add should clamp at `stockCount` or surface the over-cap error before dispatch.

## Suggested Fix

```ts
const addItem = useCallback(
  (productId: string, quantity = 1, size: string | null = null) => {
    const product = getProductById(productId);
    if (!product || product.stockCount <= 0) {
      toast.push(`Sorry, ${product?.name ?? 'this item'} is out of stock.`, { variant: 'error' });
      return;
    }
    const existing = state.items.find(
      (it) => it.productId === productId && it.size === size,
    );
    const newQty = (existing?.quantity ?? 0) + quantity;
    if (newQty > product.stockCount) {
      toast.push(`Only ${product.stockCount} available.`, { variant: 'error' });
      return;
    }
    dispatch({ type: 'ADD_ITEM', payload: { productId, quantity, size } });
  },
  [dispatch, toast, state.items],
);
```

Failing test to be added once the fix is shipped.
