import { test as setup, expect } from '@playwright/test';
import { emailInput, passwordInput, signInSubmit } from '../lib/locators.ts';

const AUTH_FILE = '.auth/user.json';
const EMAIL = process.env.E2E_USER_EMAIL ?? 'test@example.com';
const PASSWORD = process.env.E2E_USER_PASSWORD ?? 'Password123!';

setup('authenticate seeded user', async ({ page }) => {
  await page.goto('/login', { waitUntil: 'domcontentloaded' });

  await emailInput(page).fill(EMAIL);
  await passwordInput(page).fill(PASSWORD);
  await signInSubmit(page).click();

  // Routing assertion: post-login redirect lands on /.
  await expect(page).toHaveURL('/');

  // Auth-state assertion: hit /account and verify the page renders the
  // seeded user's email. /account is a ProtectedRoute, so an unauthenticated
  // session would bounce to /login, but a routing pass alone isn't enough.
  // A buggy SUT could route us to /account without a valid session and
  // render an empty profile. Asserting on user-bound content (the email
  // string we just logged in with) is the strongest user-visible proof
  // that the storage state we're about to save represents a real session.
  await page.goto('/account', { waitUntil: 'domcontentloaded' });
  await expect(page).toHaveURL('/account');
  await expect(page.getByTestId('account-email')).toHaveText(EMAIL);

  await page.context().storageState({ path: AUTH_FILE });
});
