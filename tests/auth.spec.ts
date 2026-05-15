import { test, expect } from './fixtures.ts';
import { emailInput, passwordInput, signInSubmit } from '../lib/locators.ts';

test.describe('Authentication', () => {
  test('[TC-AUTH-001] login with seeded credentials lands on / @P0', async ({ page }) => {
    await page.goto('/login', { waitUntil: 'domcontentloaded' });

    await emailInput(page).fill('test@example.com');
    await passwordInput(page).fill('Password123!');
    await signInSubmit(page).click();

    await expect(page).toHaveURL('/');
    await expect(page.getByText('Welcome back!')).toBeVisible();
  });

  test('[TC-AUTH-002] invalid credentials show inline error and stay on /login @P0', async ({ page }) => {
    await page.goto('/login', { waitUntil: 'domcontentloaded' });

    await emailInput(page).fill('wrong@example.com');
    await passwordInput(page).fill('NotTheRightPassword1!');
    await signInSubmit(page).click();

    await expect(page.getByTestId('login-error')).toHaveText('Invalid email or password');
    await expect(page).toHaveURL(/\/login/);
  });

  test('[TC-AUTH-003] register a new account → redirected to / @P0', async ({ page }) => {
    await page.goto('/register', { waitUntil: 'domcontentloaded' });

    const uniqueEmail = `new-${Date.now()}@example.com`;

    await page.getByTestId('register-name').fill('New Customer');
    await page.getByTestId('register-email').fill(uniqueEmail);
    await page.getByTestId('register-password').fill('Hunter2Hunter2!');
    await page.getByTestId('register-confirm').fill('Hunter2Hunter2!');

    await page.getByTestId('register-submit').click();

    await expect(page).toHaveURL('/');
    await expect(page.getByText('Account created!')).toBeVisible();
  });

  test('[TC-AUTH-005] register: mismatched passwords show field-level error, stay on /register @P1', async ({ page }) => {
    await page.goto('/register', { waitUntil: 'domcontentloaded' });

    await page.getByTestId('register-name').fill('Mismatch User');
    await page.getByTestId('register-email').fill(`mismatch-${Date.now()}@example.com`);
    await page.getByTestId('register-password').fill('Hunter2Hunter2!');
    await page.getByTestId('register-confirm').fill('NotTheSame123!');
    await page.getByTestId('register-submit').click();

    // Field-level error pinpoints the failing field; stronger than the
    // form-level banner and avoids relying on banner-render order.
    await expect(page.getByTestId('register-confirm-error')).toHaveText(
      'Passwords do not match',
    );
    await expect(page).toHaveURL(/\/register/);
  });

  test('[TC-AUTH-006] register: duplicate email surfaces "already exists" error @P1', async ({ page }) => {
    await page.goto('/register', { waitUntil: 'domcontentloaded' });

    // test@example.com is the seeded demo user — registering it again must fail.
    await page.getByTestId('register-name').fill('Demo Clone');
    await page.getByTestId('register-email').fill('test@example.com');
    await page.getByTestId('register-password').fill('Hunter2Hunter2!');
    await page.getByTestId('register-confirm').fill('Hunter2Hunter2!');
    await page.getByTestId('register-submit').click();

    await expect(page.getByTestId('register-error')).toContainText(/already exists/i);
    await expect(page).toHaveURL(/\/register/);
  });

  // Logout runs last because it has to be sequenced after a successful login.
  // Numbered TC-AUTH-007 so the file reads top-to-bottom in IDs order.
  test('[TC-AUTH-007] logout returns to the anonymous menu and re-arms the route guard @P0', async ({ page }) => {
    await page.goto('/login', { waitUntil: 'domcontentloaded' });
    await emailInput(page).fill('test@example.com');
    await passwordInput(page).fill('Password123!');
    await signInSubmit(page).click();
    await expect(page).toHaveURL('/');

    await page.getByRole('button', { name: 'Account menu' }).click();
    await page.getByTestId('account-menu-logout').click();

    await page.getByRole('button', { name: 'Account menu' }).click();
    await expect(page.getByTestId('account-menu-login')).toBeVisible();
    await expect(page.getByTestId('account-menu-logout')).toHaveCount(0);

    await page.goto('/account', { waitUntil: 'domcontentloaded' });
    await expect(page).toHaveURL(/\/login\?redirect=%2Faccount/);
  });
});
