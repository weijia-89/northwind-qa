import { defineConfig, devices } from '@playwright/test';

// Default SUT location: cloned as a peer directory of this repo. Override
// with E2E_SUT_DIR for any other layout.
const SUT_DIR =
  process.env.E2E_SUT_DIR ?? '../example-e-commerce-website';

const PORT = Number(process.env.E2E_PORT ?? 5173);
const BASE_URL = process.env.E2E_BASE_URL ?? `http://localhost:${PORT}`;

export default defineConfig({
  testDir: './tests',
  timeout: 20_000,
  expect: { timeout: 5_000 },

  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : undefined,

  reporter: [
    ['list'],
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
    ['json', { outputFile: 'test-results/results.json' }],
  ],

  use: {
    baseURL: BASE_URL,
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
    video: 'retain-on-failure',
    actionTimeout: 5_000,
    navigationTimeout: 10_000,
  },

  projects: [
    {
      name: 'setup',
      testMatch: /.*\.setup\.ts$/,
    },
    {
      name: 'chromium-anon',
      testMatch:
        /(auth|home|product-list|product-detail|cart|promo|a11y|cookie-consent)\.spec\.ts$/,
      use: { ...devices['Desktop Chrome'] },
      dependencies: ['setup'],
    },
    {
      name: 'chromium-auth',
      testMatch: /(checkout|account)\.spec\.ts$/,
      use: {
        ...devices['Desktop Chrome'],
        storageState: '.auth/user.json',
      },
      dependencies: ['setup'],
    },
  ],

  webServer: {
    command: process.env.E2E_DEV_CMD ?? 'npm run dev',
    cwd: SUT_DIR,
    port: PORT,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    stdout: 'pipe',
    stderr: 'pipe',
  },
});
