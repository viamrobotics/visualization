<!--
@component

Builds a real `Gizmos` plugin context and a settings stand-in, hands both to `GizmoMenu`
as props the way `Gizmos.svelte` does, and returns them through `onReady` so a spec can
assert against the same objects the menu writes to. `$state` survives Svelte's props
proxy, which a plain object would not.
-->
<script lang="ts">
	import { untrack } from 'svelte'

	import type { Settings } from '$lib/hooks/useSettings.svelte'

	import GizmoMenu from '../../GizmoMenu.svelte'
	import { provideGizmos } from '../../useGizmos.svelte'

	interface Props {
		onReady: (ready: { gizmos: ReturnType<typeof provideGizmos>; settings: Settings }) => void
	}

	const { onReady }: Props = $props()

	const settings = $state({ snapping: false } as Settings)

	// Read untracked: the context is established once at setup and a harness never swaps
	// its callback mid-test.
	const gizmos = untrack(() => {
		const ready = provideGizmos(() => undefined)
		onReady({ gizmos: ready, settings })
		return ready
	})
</script>

<GizmoMenu
	{gizmos}
	{settings}
/>
