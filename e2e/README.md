# End-to-End Testing Guide

This guide explains how to run and manage the Playwright end-to-end tests for the motion-tools application.

The tests now provision their own ephemeral Viam machine for each run.

## Prerequisites

Before running the tests, make sure you have:

- **Go** (to build the `world-state-store` test module).
- **The Viam CLI** installed and authenticated:

  ```bash
  # macOS
  brew install viam
  # or see https://docs.viam.com/dev/tools/cli/ for other platforms

  viam login
  ```

- **Access to a `Viam Viz E2E` organization.** If your account doesn't already belong to one, create it at [app.viam.com](https://app.viam.com/) with the exact name `Viam Viz E2E`; the setup script will detect it on the next run.

## Running E2E Tests

```bash
# basic run
pnpm test:e2e

# with ui
pnpm test:e2e-ui
```

### Running specific tests

```bash
# run a single test file
npx playwright test e2e/world-state-store.test.ts

# run a single test by title
npx playwright test e2e/edit-frame.test.ts --grep "basic edit frame"
```

## Understanding Test Results

### Screenshot Comparison

Playwright captures screenshots during test execution and compares them against baselines stored in `e2e/<test-name>.test.ts-snapshots/`. Failures produce:

- `actual.png` — the current screenshot
- `expected.png` — the baseline
- `diff.png` — a visual diff

These land in the `test-results/` folder.

NOTE: running many tests back-to-back can be flaky because each test shares the same ephemeral machine. If a test fails, try re-running just that one with `--grep` before investigating further.

## Updating Screenshots

When you make intentional UI changes that should change screenshots:

1. Run with the update flag:
   ```bash
   pnpm test:e2e -u
   ```
2. Review the updated files in `e2e/**/*-snapshots/`.
3. Commit the new snapshots alongside your code changes.

> Only update screenshots when you've intentionally modified the UI. Random test failures should be investigated rather than blindly updating snapshots.

## Troubleshooting

- **`viam-server binary not found at .../e2e/.bin/viam-server`**
  Run `cd e2e && ./setup.sh` to install it.
- **`E2E config not found at .../e2e/.env.e2e`**
  Same fix — run `cd e2e && ./setup.sh`. The script will create the API key and write the file.
- **`Organization "Viam Viz E2E" not found`**
  Your Viam CLI user doesn't have access to an org named exactly `Viam Viz E2E`. Create one at [app.viam.com](https://app.viam.com/) or ask to be added, then re-run setup.
- **Not authenticated with the Viam CLI**
  Run `viam login` and re-run `./e2e/setup.sh`.
- **Stuck/stale machines in the cloud**
  Global teardown deletes the machine it created, but if a run is killed (SIGKILL, crash) it may leak. Clean up orphaned `e2e-<username>-*` machines under the `e2e-tests` location in the `Viam Viz E2E` org.
