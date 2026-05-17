# Test data

The storefront has no backend, products are hardcoded, users/cart/orders persist in `localStorage`. All test fixtures referenced below come from the SUT source, not seeded by this suite.

## Demo user (auto-seeded)

| Field | Value |
| --- | --- |
| Email | `test@example.com` |
| Password | `Password123!` |

Defined in `src/context/AuthContext.tsx:28-34` and seeded into `localStorage['ec_users_v1']` on first app load. Override with `E2E_USER_EMAIL` / `E2E_USER_PASSWORD`.

## Promo code

| Field | Value |
| --- | --- |
| Code | `WELCOME10` (case-insensitive, trimmed) |
| Discount | 10% off subtotal |
| Reuse policy | One-time per browser (see `bugs/B-002`) |

Defined in `src/context/CartContext.tsx:45-46`.

## Free shipping threshold

`$50.00`, defined in `src/context/CartContext.tsx:43`. Sub-threshold orders pay `$5.99` standard shipping.

## Test card (checkout happy path)

| Field | Value |
| --- | --- |
| Number | `4242 4242 4242 4242` |
| Expiry | `12/30` |
| CVC | `123` |

Per the comment at `src/utils/validators.ts:35`, the validator is Luhn-style and accepts the standard Stripe test card. Any Luhn-valid number works; this is the documented one.

## Stable product fixtures

Used as anchor data for cart/checkout/promo tests. Picked because they're **non-apparel** (so `ProductCard` renders a real `<button>Add to cart</button>`, not a `<Link>Choose options</Link>`) and **in stock**.

| Slug | Name | Price | Stock | Featured | Notes |
| --- | --- | --- | --- | --- | --- |
| `canvas-tote-bag` | Heavy Canvas Tote Bag | $28.00 | 30 | yes | Cheap, sub-free-shipping |
| `enamel-pour-over-kettle` | Enamel Pour-Over Kettle | $64.00 | 6 | no | Above $50 free-ship threshold |
| `cashmere-cardigan` | Cashmere Cardigan | $165.00 | 4 | yes | High value, low stock |

Apparel fixtures (require size selection through detail page):

| Slug | Name | Sizes |
| --- | --- | --- |
| `classic-white-tee-mens` | Classic White Tee | XS, S, M, L, XL |

Out-of-stock fixtures (button is `disabled`):

| Slug | Name |
| --- | --- |
| `selvedge-denim-jeans` | Selvedge Denim Jeans |
| `striped-breton-top` | Striped Breton Top |
| `wool-felt-fedora` | Wool Felt Fedora |

## State that survives a test

Each Playwright test runs in a fresh `BrowserContext`, so `localStorage` and `sessionStorage` start empty. Tests that need pre-loaded auth opt in via the `chromium-auth` project, which loads `.auth/user.json` (produced by `tests/auth.setup.ts`).

If a test needs to seed pre-existing cart/promo state, use `addInitScript` *inside that test*, not in the shared fixture, see `tests/fixtures.ts` for why the shared fixture deliberately doesn't clear storage.
