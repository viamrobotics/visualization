<!--
@component

Builds a real `Gizmos` plugin context, hands it to `GizmoMenu` as a prop the way
`Gizmos.svelte` does, and returns it through `onReady` so a spec can assert against the
same object the menu writes to. The object's getters and setters survive Svelte's props
proxy, which a plain stand-in object would not.
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
	const gizmos = untrack(() => {
		const ready = provideGizmos(() => undefined)
		onReady(ready)
		return ready
	})
</script>

<GizmoMenu {gizmos} />
