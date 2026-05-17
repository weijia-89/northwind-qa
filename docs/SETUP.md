# Setup

## Prerequisites

- **Node 20+**.
- **npm** for this repo. **pnpm** for the SUT (its `packageManager` pin and `pnpm-lock.yaml` make it the canonical install tool). Node 16.13+ ships `corepack`, which can provision pnpm on demand: `corepack enable && corepack prepare pnpm@latest --activate`.
- The storefront source cloned as a peer directory of this repo (so `../example-e-commerce-website` resolves correctly). Override with `E2E_SUT_DIR` if it lives elsewhere.
- Playwright still boots the SUT via `npm run dev` by default, which works because the SUT's `dev` script delegates to Vite. Override with `E2E_DEV_CMD=pnpm\ dev` if your SUT's dev script needs pnpm specifically.

## Install

```bash
# In this repo
npm install
# That's it. The `pretest` hook in package.json runs `playwright install
# chromium` automatically the first time you run `npm test`. On Linux CI
# use `npm run install:browsers` (which adds `--with-deps`) to pull system
# libraries as well.

# In the SUT (only required once)
cd ../example-e-commerce-website    # or wherever you cloned it; set E2E_SUT_DIR otherwise
# Match the SUT's lockfile: `pnpm install --frozen-lockfile` if pnpm-lock.yaml
# exists (the current case), otherwise `npm ci`. Mixing tools across the
# pnpm lockfile risks subtly-different dependency versions than CI.
pnpm install --frozen-lockfile
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

## CI on GitHub

[`.github/workflows/playwright.yml`](../.github/workflows/playwright.yml) runs on push to `main`, on PRs targeting `main`, and on manual `workflow_dispatch`.

### Repo variable (required)

| Name | Example | Purpose |
| --- | --- | --- |
| `SUT_REPO` | `owner/example-e-commerce-website` | Where to clone the SUT from |
| `SUT_REF` | `main` (default) | Optional. Branch/tag/SHA of the SUT to check out |

Set under *Settings → Secrets and variables → Actions → Variables*. If `SUT_REPO` is unset the workflow fails at preflight with an actionable error.

### Deploy key (required when SUT repo is private)

GitHub scopes the default `GITHUB_TOKEN` to the workflow's own repo, so it cannot read a private SUT. Wire a read-only deploy key pinned to the SUT repo:

```bash
# 1. Generate an ed25519 keypair locally. No passphrase (CI runs non-interactively).
ssh-keygen -t ed25519 -C "northwind-qa CI" -f /tmp/sut_deploy -N "" -q

# 2. Add the public half to the SUT repo's deploy keys, marked Read-only
gh repo deploy-key add /tmp/sut_deploy.pub \
  --repo OWNER/example-e-commerce-website \
  --title "northwind-qa CI"

# 3. Save the private half as the SUT_DEPLOY_KEY secret on THIS repo.
#    Piped via stdin so the key never echoes to your terminal or shell history.
gh secret set SUT_DEPLOY_KEY \
  --repo OWNER/northwind-qa < /tmp/sut_deploy

# 4. Remove the local keypair
rm /tmp/sut_deploy /tmp/sut_deploy.pub
```

Verify with `gh repo deploy-key list --repo OWNER/example-e-commerce-website` (should show one entry marked `read-only`) and `gh secret list --repo OWNER/northwind-qa` (should list `SUT_DEPLOY_KEY`).

**Web UI alternative if you don't have `gh` installed:** SUT repo → *Settings → Deploy keys → Add deploy key* (paste the contents of `sut_deploy.pub`; leave *Allow write access* unchecked). Then northwind-qa repo → *Settings → Secrets and variables → Actions → New repository secret* (name it `SUT_DEPLOY_KEY`, paste the contents of `sut_deploy`, which is the private half).

If the SUT repo is public, leave `SUT_DEPLOY_KEY` unset. The `ssh-key:` parameter is optional and `actions/checkout` falls back to https + `GITHUB_TOKEN` for any public repo.

The rationale for picking deploy key over a fine-grained PAT is in [`DECISIONS.md`](DECISIONS.md#ci).
