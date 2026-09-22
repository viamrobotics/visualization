---
paths:
  - '**/*.svelte'
---

# Svelte Lifecycle in This Repo

**Never `onDestroy` in a `.svelte` component.** Subscribe inside `$effect` and return the
unsubscribe function as the teardown.

```svelte
<script lang="ts">
	// Wrong: the subscription outlives every dependency change and only unwinds at unmount.
	onDestroy(world.onAdd(traits.Name, handler))

	// Right: setup and teardown in one place, re-run together.
	$effect(() => {
		return world.onAdd(traits.Name, handler)
	})
</script>
```

Setup and teardown belong to the same rune, so neither can be moved or deleted without the
other. `onDestroy` splits them, and it fires only at unmount, so a subscription whose inputs
changed keeps running against the old ones until the component goes away.

This covers `.svelte` components. `onDestroy` in a `.svelte.ts` hook is how a composable
releases what it registered against a context that outlives it, which `useHotkey` and
`useEnvironmentMode` both do. Four components predate this rule and still call `onDestroy`.
Convert one when you are already editing it, not as a sweep.

Svelte 5 authoring conventions beyond lifecycle live in `svelte.md`. `$effect.pre` versus
`$effect`, and why a per-frame update is `useTask` rather than either, live in
`threlte-scene.md`.
