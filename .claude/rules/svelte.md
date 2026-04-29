---
paths:
  - '**/*.svelte'
  - '**/*.svelte.ts'
  - '**/*.svelte.js'
---

# Svelte 5

We use Svelte 5 runes throughout — no Svelte 4 syntax. See the [Svelte 5 docs](https://svelte.dev/docs/svelte).

**Component conventions:** typed `Props` interface (extend the relevant HTML attributes type when wrapping a native element); `$props()` with defaults and rest spread passed to the element; `$derived` for computed values; `{@render children?.()}` for composition. Never use `<slot>` — always snippets.

Use `$state.raw` for values without deep reactivity (large arrays replaced wholesale, Three.js class instances). Use `untrack(() => value)` to read reactive state without registering a dependency.

**Never use `$effect` to derive state** — use `$derived`. `$effect` is for side effects only (DOM mutations, subscriptions).

## State Management with Koota ECS

This project uses [Koota](https://github.com/pmndrs/koota) (Entity Component System) for shared scene state — not Svelte stores or TanStack Query.

- **Traits** are defined in `src/lib/ecs/traits.ts`. Marker traits return `() => true`; data traits return a default value factory.
- **World** is injected via Svelte context: call `provideWorld()` at the root, `useWorld()` to consume.
- **Reactive queries** via `useQuery` from `$lib/ecs`: `const meshEntities = useQuery(traits.Mesh)`
- **Trait access** on a specific entity via `useTrait` from `$lib/ecs`: `const pose = useTrait(entity, traits.Pose)`
- **Relations** (`ChildOf`, `SubEntityLink`) are in `src/lib/ecs/relations.ts`.

Default to local component state (`$state`, `$derived`) for UI-only values. Use Koota ECS for shared scene/entity data. Use Svelte context for shared service/config objects.

## Context Providers

Use `.svelte.ts` files with `getContext`/`setContext` for reactive shared state:

- Always use `Symbol()` keys — prevents accidental collisions
- Return objects with **getters**, not plain properties, to preserve reactivity across context boundaries
- Naming: `provide*` to inject into context, `use*` to consume

## 3D Rendering with Threlte

This project renders a 3D scene using [Threlte](https://threlte.xyz/) (Svelte bindings for Three.js). All 3D components live inside a Threlte `<Canvas>` context. Custom Three.js extensions live in `src/lib/three/` and are mounted with `<T is={obj} />`.

**Rendering is on-demand, not continuous.** Call `invalidate()` (from `useThrelte()`) after mutating scene objects to trigger a re-render. Use `useTask` for continuous per-frame updates — never `$effect`, which does not participate in Threlte's task scheduler.

**`$effect.pre`** — use instead of `$effect` when mutating buffer geometry attributes, so mutations happen before the render rather than after.

**`dispose={false}`** — pass when you manage the Three.js object's lifecycle yourself (pooled or shared instances).

**BVH / raycasting** — opt out objects that don't need hit-testing: `bvh={{ enabled: false }}` or `raycast={() => null}` for display-only geometry.

## Accessibility

- Use semantic elements and correct ARIA roles; label all interactive elements.
- Hide decorative icons with `aria-hidden="true"`.
- Use `aria-disabled` instead of `disabled` when the element must remain focusable.

## Styling

Use array/object syntax for conditional classes:

```svelte
<button class={[
  'inline-flex items-center font-medium rounded',
  { 'bg-blue-600': variant === 'primary', 'bg-red-600': variant === 'danger' },
  disabled && 'opacity-50 cursor-not-allowed',
]}>
```

## Svelte MCP Server

Use the Svelte MCP server for authoritative Svelte 5 / SvelteKit docs and validation. Delegate to the `svelte-file-editor` agent when creating or editing `.svelte`, `.svelte.ts`, or `.svelte.js` files — it handles MCP calls efficiently.

- `list-sections` — call FIRST on any Svelte/SvelteKit question to discover relevant docs (returns titles, use_cases, paths).
- `get-documentation` — fetch every section whose `use_cases` matches the task. Batch multiple sections in one call.
- `svelte-autofixer` — run on any Svelte code you write before handing it to the user. Keep iterating until it returns no issues or suggestions.
- `playground-link` — only offer after code is complete AND the user confirms. NEVER call it for code written to files in the project.

## Verify Your Work

```
pnpm check    # svelte-check + go vet
pnpm lint     # prettier + eslint + golangci-lint
```
