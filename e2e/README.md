# End-to-End Testing Guide

This guide explains how to run and manage the Playwright end-to-end tests for the motion-tools application.

## Prerequisites

Before running the tests, ensure you have:

- A robot that you own and can control
- The robot is online and accessible
- Admin access to the robot's configuration

## Running E2E Tests

### Step 1: Configure Test Settings

Update the `testConfig` object at the top of the test file (`edit-frame.test.ts`) with your robot's details:

- Host address
- Part ID
- API Key ID and Value
- Signaling Address

### Step 2: Prepare Your Robot

1. **Start your robot** and ensure it's online
2. **Update robot configuration** using the JSON config found in the test file comments
   - Navigate to the Configuration tab in the Viam app
   - Apply the provided configuration to your robot

### Step 3: Execute Tests

Run the test suite using:

```bash
pnpm run test:e2e
```

## Understanding Test Results

### Screenshot Comparison

Playwright automatically captures screenshots during test execution and saves them in the `test-results/` folder. The testing framework compares these screenshots against baseline images stored in `e2e/edit-frame.test.ts-snapshots/`.

### Test Failures

When a screenshot comparison fails, Playwright generates three files:

- `actual.png` - The current screenshot from the test
- `expected.png` - The baseline screenshot for comparison
- `diff.png` - A visual diff highlighting the differences

## Updating Screenshots

When you make intentional UI changes that should result in different screenshots:

1. **Run tests with update flag:**

   ```bash
   pnpm run test:e2e -u
   ```

2. **Review the changes** in the updated snapshot files

3. **Commit the new snapshots** along with your code changes

> **Note:** Only update screenshots when you've intentionally modified the UI. Random test failures should be investigated rather than blindly updating snapshots.

## Todo

1. Use Fleet API as a fixture to auto change the robot config instead of relying on user to upload thesmselves
2. add more e2e tests to cover additional user journeys
