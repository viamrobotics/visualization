---
paths:
  # Scoped to src/ so Playwright e2e suites (e2e/*.test.ts) stay out of scope.
  # This repo configures vitest inside vite.config.ts and deliberately runs one
  # browser-mode project. See testing-frontend.md before applying the project split.
  - 'src/**/*.test.ts'
  - 'src/**/*.spec.ts'
  - '**/vitest.config.ts'
---

# Testing — Svelte

Runner setup for testing Svelte 5 components and `.svelte.ts` reactive modules. See
`testing.md` for the runner-agnostic rules on placement, structure, and naming that this
guide assumes, and `svelte.md` for authoring conventions, which this guide does not repeat.

## Rule — follow without deliberation

- **Test a component under Vitest browser mode, not jsdom.** jsdom does not run a real
  layout or paint pipeline, and Svelte 5's `$effect` timing is scheduled around the
  browser's microtask and rAF queues. Under jsdom, an effect can flush on a different tick
  than it does in a real browser, so a test can read the DOM before an effect that would
  have run by then in production, or after one that would not have. Either way the test
  passes on a timing accident. It stays green through a real render bug and would fail the
  moment the same component runs in an actual browser, which is worse than not testing the
  component at all, since the green result is actively misleading.
- **Reach for jsdom only for logic that never touches Svelte's effect scheduler**, such as
  a plain utility that happens to import `document`. The moment a test renders a component
  or calls `$effect`, move it to a browser project.
- **Split the Vitest config into three projects: `client`, `ssr`, and `server`.** One merged
  config forces every test to run under a single environment, so a component test that only
  passes because it never actually mounted in a browser sits next to a server test that
  never needed a DOM at all. Each project targets what it is actually testing:
  - `client`: components rendered and interacted with, in browser mode.
  - `ssr`: the server-rendered HTML string a component produces, via Svelte's `render`
    from the `/server` entry point. Catches a component that throws or reads `window` when
    it runs where there is no `window`.
  - `server`: plain modules with no Svelte compilation, such as a data-loading function or
    a `.ts` utility.

## Checked mechanically

`test-config.mjs` catches a Svelte vitest config missing the `client`, `ssr`, or `server`
project. Whether a given test belongs under browser mode or jsdom is still a human read.

## Example — a three-project `vitest.config.ts`

Verified against Vitest 4.1: the merged `vitest.workspace.ts` file is gone, and
`test.projects` on a single config takes its place. Browser mode's provider is its own
package, `@vitest/browser-playwright` here rather than the old `@vitest/browser`.

```ts
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    projects: [
      {
        extends: true,
        plugins: [svelte()],
        test: {
          name: 'client',
          include: ['src/**/*.svelte.{test,spec}.ts'],
          browser: {
            enabled: true,
            provider: 'playwright',
            instances: [{ browser: 'chromium' }],
          },
        },
      },
      {
        extends: true,
        plugins: [svelte({ compilerOptions: { hydratable: true } })],
        test: {
          name: 'ssr',
          include: ['src/**/*.ssr.{test,spec}.ts'],
          environment: 'node',
        },
      },
      {
        extends: true,
        test: {
          name: 'server',
          include: ['src/**/*.{test,spec}.ts'],
          exclude: [
            'src/**/*.svelte.{test,spec}.ts',
            'src/**/*.ssr.{test,spec}.ts',
          ],
          environment: 'node',
        },
      },
    ],
  },
});
```

`extends: true` pulls in the shared root config, `plugins` and `resolve` in particular, so
each project only states what makes it different. Name a test file for the project it
belongs to (`*.svelte.test.ts` for `client`, `*.ssr.test.ts` for `ssr`) so `include` can
route it without a human sorting it by hand.
