# B-005: Anonymous checkout flow surprises the user with a login wall

An anonymous user with items in their cart clicks "Proceed to checkout" on `/cart`. `CartPage` calls `navigate('/checkout')`. `ProtectedRoute` then redirects them to `/login?redirect=%2Fcheckout` with no warning. The cart contents survive (good, they're in localStorage), but the user's mental model breaks: they expected a checkout form, they got a login form.

## Reproduction

1. From a fresh browser (logged out), open `/products`.
2. Click "Add to cart" on any non-apparel product.
3. Click the cart icon → "View cart".
4. Click "Proceed to checkout".
5. **Observed:** Hard navigation to `/login?redirect=%2Fcheckout`. No "Sign in to check out" hint, no progressive disclosure.
6. **Expected:** Either
   - The cart-page checkout button should say "Sign in to check out" when unauthenticated, or
   - A modal/inline notice should explain "You'll need to sign in to place an order. Continue?" before the redirect.

## Expected Behaviour

The checkout button on `/cart` should be auth-aware. The ProtectedRoute redirect remains as a defence-in-depth, but the primary UX path shouldn't surprise the user.

## Suggested Fix

```tsx
// CartPage.tsx
const { isAuthenticated } = useAuth();

<Button
  variant="primary"
  block
  onClick={() => navigate(isAuthenticated ? '/checkout' : '/login?redirect=%2Fcheckout')}
  data-testid="cart-checkout"
>
  {isAuthenticated ? 'Proceed to checkout' : 'Sign in to check out'}
</Button>
```

Mirror the same change for the cart drawer's "Go to checkout" button.

## Test Coverage

`tests/cart.spec.ts` → `[TC-CART-008]` asserts the redirect behaviour (anonymous user clicks "Proceed to checkout" on `/cart` → lands on `/login?redirect=%2Fcheckout`, cart survives). Once the SUT adopts the recommended button-label change, add a follow-up assertion:

```ts
await expect(cartCheckoutButton(page)).toHaveText('Sign in to check out');
```
