---
paths:
  - 'src/**/*.spec.ts'
---

# Frontend Testing (Vitest)

Use real implementations for pure logic — mock only external I/O boundaries (network, filesystem, time). Use `it.each` for parameterized cases instead of duplicating test bodies.

## Static Analysis

| Language   | Tools                                                                                |
| ---------- | ------------------------------------------------------------------------------------ |
| TypeScript | ESLint (`@typescript-eslint`), Prettier — run via `pnpm lint`                        |
| Svelte     | `svelte-check`, ESLint (`eslint-plugin-svelte`) — run via `pnpm check` / `pnpm lint` |

## Svelte Component Tests

Use [@testing-library/svelte](https://testing-library.com/docs/svelte-testing-library/intro):

```typescript
import { render, screen } from '@testing-library/svelte'
import userEvent from '@testing-library/user-event'

it('increments count on click', async () => {
	const user = userEvent.setup()
	render(Counter)
	await user.click(screen.getByRole('button', { name: /increment/i }))
	expect(screen.getByText('1')).toBeInTheDocument()
})
```

**Query priority:** `getByRole` > `getByLabelText` > `getByText` > `getByTestId`. Add `data-testid` only when no semantic selector exists.

## Injecting Context

Pass a `context` map when the component depends on Svelte context:

```typescript
render(UserProfile, {
	context: new Map([[USER_CONTEXT_KEY, { name: 'Alice', role: 'admin' }]]),
})
```

For complex context trees, create a `__fixtures__/ContextWrapper.svelte` that provides all required contexts and accepts the component under test as a snippet.

## Browser Mode

Not currently adopted. If you need real browser APIs unavailable in jsdom (`ResizeObserver`, `IntersectionObserver`, `canvas`), use [Vitest Browser Mode](https://vitest.dev/guide/browser/) and name the file `*.browser.spec.ts`.

## Verify Your Work

```
pnpm check    # svelte-check + go vet
pnpm test     # vitest unit tests
```
