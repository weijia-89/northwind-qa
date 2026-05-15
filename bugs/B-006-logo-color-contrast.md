# B-006 — Header logo "Goods" fails WCAG 2 AA color contrast

Discovered by `tests/a11y.spec.ts` (axe-core). Affects every route since the header is shared.

The header brand mark "Northwind <span>Goods</span>" colors the second word `#fbbf24` (amber) on a `#ffffff` (white) background. Computed contrast ratio: **1.66:1**. WCAG 2 AA requires **3:1** for large bold text (≥18pt or ≥14pt bold).

axe rule: [`color-contrast`](https://dequeuniversity.com/rules/axe/4.11/color-contrast). Impact: serious. Tags: `wcag2aa`, `wcag143`, `EN-301-549`, `EN-9.1.4.3`.

## Reproduction

1. Open any route (e.g. `/`).
2. Run axe-core scan or open DevTools → Lighthouse → Accessibility.
3. Observe the violation on `header > a > span` containing `Goods`.

axe output excerpt:

```
Element has insufficient color contrast of 1.66
  foreground: #fbbf24
  background: #ffffff
  font size:  15.0pt (20px), bold
  expected:   3:1
target: ._logo_561gc_18 > span
```

## Expected

The "Goods" span should pass 3:1 against its background. Cheapest fix: pick a darker amber (e.g. `#b45309` is 4.5:1 on white) or move the brand mark over a dark background bar.

## Suggested Fix

```css
/* Header.module.css */
.logo span {
  color: #b45309; /* was #fbbf24 — fails WCAG 2 AA */
}
```

Or change the brand block to a dark backplate so the existing amber works.

## Test Coverage

`tests/a11y.spec.ts` → `[TC-A11Y-001]` runs axe on `/`. This violation is currently allowlisted (see `KNOWN_ISSUES` in that file) so the suite passes; on fix, remove the allowlist entry and the same test becomes a regression guard.