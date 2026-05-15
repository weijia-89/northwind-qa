import AxeBuilder from '@axe-core/playwright';
import type { Result } from 'axe-core';
import { test, expect } from './fixtures.ts';

// Allowlist for known issues that already have a bug filed. Removing an
// entry once the SUT fixes the bug turns the test into a regression guard.
const KNOWN_ISSUES: Array<{ ruleId: string; targetIncludes: string; bug: string }> = [
  { ruleId: 'color-contrast', targetIncludes: '_logo_', bug: 'B-006' },
];

function isKnown(violation: Result): boolean {
  return KNOWN_ISSUES.some(
    (known) =>
      violation.id === known.ruleId &&
      violation.nodes.some((node) =>
        node.target.some((sel) => String(sel).includes(known.targetIncludes)),
      ),
  );
}

test('[TC-A11Y-001] no new critical/serious axe violations on / @P1', async ({ page }) => {
  await page.goto('/', { waitUntil: 'domcontentloaded' });

  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa'])
    .analyze();

  const blocking = results.violations.filter(
    (v) => ['serious', 'critical'].includes(v.impact ?? '') && !isKnown(v),
  );

  expect(
    blocking,
    `New axe violations on /: ${blocking.map((v) => v.id).join('; ')}`,
  ).toEqual([]);
});
