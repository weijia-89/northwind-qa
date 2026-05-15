# Setup

## Prerequisites

- **Node 20+**.
- **npm** (default Node CLI). The SUT pins `pnpm` in `packageManager`, but the test harness boots it via `npm run dev`, which only needs the `dev` script in `package.json`. If you have pnpm installed, override with `E2E_DEV_CMD=pnpm\ dev`.
- The storefront source cloned as a peer directory of this repo (so `../example-e-commerce-website` resolves correctly). Override with `E2E_SUT_DIR` if it lives elsewhere.

## Install

```bash
# In this repo
npm install
npm run install:browsers   # downloads Chromium for Playwright

# In the SUT (only required once)
cd ../example-e-commerce-website    # or wherever you cloned it; set E2E_SUT_DIR otherwise
npm install                          # works against the SUT's package-lock.json
```

## Run

```bash
npm test                # all projects, headless
npm run test:headed     # watch a browser
npm run test:ui         # Playwright UI mode
npm run test:debug      # Playwright Inspector
npm run test:report     # open the last HTML report
npm run typecheck       # tsc --noEmit, catches type errors before runtime
```

`playwright.config.ts` boots the storefront via its own `webServer` block, so you do **not** need to start `npm run dev` separately. If a server is already on port 5173, Playwright reuses it (in non-CI mode).

## Configuration knobs

| Variable | Default | Purpose |
| --- | --- | --- |
| `E2E_SUT_DIR` | `../example-e-commerce-website` | Where to `cd` for `npm run dev` |
| `E2E_PORT` | `5173` | Vite dev port |
| `E2E_BASE_URL` | `http://localhost:${E2E_PORT}` | Override entirely (e.g. point at a hosted preview) |
| `E2E_USER_EMAIL` | `test@example.com` | Demo user email (auto-seeded by AuthContext) |
| `E2E_USER_PASSWORD` | `Password123!` | Demo user password |
| `E2E_DEV_CMD` | `npm run dev` | Command Playwright runs to boot the SUT (set to `pnpm dev` if you prefer pnpm) |
| `CI` | unset | When set, retries=1 and forbidOnly=true |

## Topology note

This repo and the SUT live in separate directories. That's a deliberate seam: the suite reviews an app it doesn't own. For a long-term project, prefer collocating tests with the SUT in a single repo and a single CI workflow.
