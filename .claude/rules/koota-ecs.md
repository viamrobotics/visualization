---
paths:
  - '**/*.svelte'
  - '**/*.svelte.ts'
  - '**/*.svelte.js'
  - 'src/lib/ecs/**'
---

# State Management with Koota ECS

This project uses [Koota](https://github.com/pmndrs/koota) (Entity Component System) for shared scene state — not Svelte stores or TanStack Query.

- **Traits** are defined in `src/lib/ecs/traits.ts`. Marker traits return `() => true`; data traits return a default value factory.
- **World** is injected via Svelte context: call `provideWorld()` at the root, `useWorld()` to consume.
- **Reactive queries** via `useQuery` from `$lib/ecs`: `const meshEntities = useQuery(traits.Mesh)`
- **Trait access** on a specific entity via `useTrait` from `$lib/ecs`: `const pose = useTrait(entity, traits.Pose)`
- **Relations** (`ChildOf`, `SubEntityLink`) are in `src/lib/ecs/relations.ts`.

Default to local component state (`$state`, `$derived`) for UI-only values. Use Koota ECS for shared scene/entity data. Use Svelte context for shared service/config objects.
