# End-to-End Testing Guide

This guide explains how to run and manage the Playwright end-to-end tests for the motion-tools application.

## Prerequisites

Before running the tests, ensure you have:

- A robot that you own and can control
- The robot is online and accessible
- Admin access to the robot's configuration

## Running E2E Tests

### Step 1: Configure Test Settings

Update the `testConfig` object at the top of the test file (`edit-frame.test.ts`) with your robot's details (it is currently configured to use a `viam-viz` robot called [`motion-tools-e2e`](https://app.viam.com/machine/cac6bcf3-4313-401d-afde-8aad0b4893a4) so you could also just run that config if you have access):

- Host address
- Part ID
- Part Name
- API Key ID and Value (with admin permission since this e2e creates and deletes a temp fragment)
- Signaling Address
- organizationId

### Step 2: Prepare Your Robot

1. **Start your robot** and ensure it's online

### Step 3: Execute Tests

Run the test suite using:

```bash
pnpm test:e2e
```

## Understanding Test Results

### Screenshot Comparison

Playwright automatically captures screenshots during test execution and saves them in the `test-results/` folder. The testing framework compares these screenshots against baseline images stored in `e2e/edit-frame.test.ts-snapshots/`.

### Test Failures

When a screenshot comparison fails, Playwright generates three files:

- `actual.png` - The current screenshot from the test
- `expected.png` - The baseline screenshot for comparison
- `diff.png` - A visual diff highlighting the differences

NOTE: running lots of these tests in sequence is somewhat flaky, if you have errors try targeting the single failing test by using the command #2 under `Running specific tests`

## Updating Screenshots

When you make intentional UI changes that should result in different screenshots:

1. **Run tests with update flag:**

   ```bash
   pnpm test:e2e -u
   ```

2. **Review the changes** in the updated snapshot files

3. **Commit the new snapshots** along with your code changes

> **Note:** Only update screenshots when you've intentionally modified the UI. Random test failures should be investigated rather than blindly updating snapshots.

### Running specific tests

1. to run just a particular test file you can use this command `npx playwright test e2e/go-client.test.ts`
2. to run just a specific test you can use `npx playwright test e2e/go-client.test.ts --grep "draw nurbs"`

## Todo

1. add more e2e tests to cover additional user journeys
