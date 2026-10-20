---
paths:
  - 'src/**/*.spec.ts'
  # The deliberate one-project browser-mode setup documented below lives here.
  - 'vite.config.ts'
  - 'vitest-setup-client.ts'
---

# Frontend Testing — Repo Specifics

Generic testing practice (placement, structure, naming, what to mock in principle) lives in the kit rules (`testing.md`, `testing-svelte.md`, `testing-typescript.md`, `testing-3d.md`). This rule records only what is particular to this repo.

## Browser mode everywhere — one project, deliberately

**Every spec already runs in a real browser.** `vite.config.ts` enables Vitest browser mode globally (headless Chromium via Playwright) for everything matching `src/**/*.{test,spec}.{js,ts}`. There is no jsdom in this repo and no client/ssr/server project split — this deviates from `testing-svelte.md`'s three-project recommendation on purpose, so don't "fix" it. `ResizeObserver`, `IntersectionObserver`, `canvas`, and the rest of the DOM API are available in any `*.spec.ts` with no opt-in.

- A cold run can fail with `Failed to fetch dynamically imported module` or `Vitest failed to find the runner` while Vite optimizes dependencies. Re-run once before investigating.
- A dependency discovered mid-run makes Vite re-optimize and reload the test worker, which Vitest flags as a flakiness risk. Add it to `optimizeDeps.include` in `vite.config.ts` rather than living with the flake.

## What to mock here

Beyond external I/O, two repo-specific boundaries:

1. **Rendering context.** Anything that needs a live `<Canvas>` or WebGL. Threlte's `useThrelte` and `useTask`, `@threlte/extras` portals, and editors that mount their own DOM all throw or hang when a component is rendered in isolation.
2. **Provider ancestors.** A hook that requires a context provider the spec does not mount, such as `useToast` needing `provideToast`.

`vitest-setup-client.ts` already mocks `@threlte/core`, `@threlte/extras`, and several `$lib/hooks/*` globally. Read it before adding a mock; re-mocking something the setup file already handles is the most common source of a spec that passes for the wrong reason. `clearMocks: true` is set in `vite.config.ts`, so mocks reset between tests and per-test teardown is unnecessary.

When a mock stands in for a typed interface, constrain it with `satisfies` so a field added or removed on the real type fails the spec rather than leaving the mock quietly wrong.

## Component tests

Use `@testing-library/svelte`. Query priority: `getByRole` > `getByLabelText` > `getByText` > `getByTestId`; add `data-testid` only when no semantic selector exists, and query it through `screen.getByTestId` rather than reaching into `container` with `querySelector`. Prefer `userEvent` over `fireEvent` — it dispatches the full sequence a real interaction produces (pointer, focus, keyboard); reach for `fireEvent` only for an event `userEvent` cannot express.

Inject Svelte context with a `context` map: `render(UserProfile, { context: new Map([[USER_CONTEXT_KEY, { name: 'Alice' }]]) })`. For complex context trees, create a `__fixtures__/ContextWrapper.svelte` that provides all required contexts and accepts the component under test as a snippet.

## Reading results

`Tests N passed` on its own is not a green run. A spec that fails to import reports zero test failures, so read the `Test Files` line too and check the count against what you expected to collect.
