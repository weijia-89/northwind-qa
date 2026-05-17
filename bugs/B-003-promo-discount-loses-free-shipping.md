# B-003: Promo can make total *higher* by tipping cart below free-shipping threshold

`shipping` is computed against `subtotalAfterDiscount`, which means applying `WELCOME10` to a cart that's just over `$50` can knock it under the free-shipping threshold. The user enters a discount, watches the discount line populate, and ends up paying more than they would have without the promo.

## Reproduction

1. Add **Heavy Canvas Tote Bag** ($28.00) and **Cashmere Cardigan** is overkill, easier:
   Add **Enamel Pour-Over Kettle** ($64.00) only, single item, $64 cart.
2. Confirm:
   - Subtotal: $64.00
   - Shipping: Free (over $50)
   - Total: **$64.00**
3. Apply `WELCOME10`.
4. **Observed:**
   - Subtotal: $64.00
   - Discount: −$6.40
   - Subtotal after discount: $57.60 (still ≥ $50, OK in this case)
5. Now pick a cart at exactly $52 (e.g. tweak quantities to land there). Repeat.
6. **Observed:**
   - Subtotal: $52.00
   - Discount: −$5.20 → subtotal after discount $46.80
   - Shipping: $5.99 (no longer free)
   - Total: **$52.79**, *higher* than the no-promo $52.00.

## Expected Behaviour

Two acceptable resolutions:

- Compute `shipping` from `subtotal` (pre-discount). Discounts shouldn't affect free-shipping eligibility.
- Surface a clear notice: "Adding $3.20 will keep your free shipping", let the user opt out of the promo.

## Suggested Fix

```ts
// Cheaper to maintain: gate free shipping on the pre-discount subtotal
const shipping =
  subtotal >= FREE_SHIPPING_THRESHOLD || lineItems.length === 0
    ? 0
    : STANDARD_SHIPPING;
```

## Test Coverage

`tests/promo.spec.ts` → `[TC-PROMO-004]` builds the $52 cart (tote $28 + candle $24), captures the pre-promo total, applies `WELCOME10`, and asserts `afterPromoTotal <= beforePromoTotal`. The test is marked `test.fail()` because today's SUT violates that invariant. When the shipping calc moves to pre-discount subtotal, the test flips green.
