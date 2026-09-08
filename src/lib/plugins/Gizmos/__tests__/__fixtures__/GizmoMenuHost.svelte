<!--
@component

Mounts `GizmoMenu` under a real `Gizmos` plugin context and hands that context back
through `onReady`, so a spec can assert against the same object the menu writes to.
Needed because `useGizmos`'s context key is private to `useGizmos.svelte.ts`, so a
spec cannot inject it through `render`'s `context` map.
-->
<script lang="ts">
	import { untrack } from 'svelte'

	import GizmoMenu from '../../GizmoMenu.svelte'
	import { provideGizmos } from '../../useGizmos.svelte'

	interface Props {
		onReady: (gizmos: ReturnType<typeof provideGizmos>) => void
	}

	const { onReady }: Props = $props()

	// Read untracked: the context is established once at setup and a harness never swaps
	// its callback mid-test.
	untrack(() => onReady(provideGizmos(() => undefined)))
</script>

<GizmoMenu />
