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

	import type { provideGizmoStorage } from '../../useGizmoStorage.svelte'

	import GizmoMenu from '../../GizmoMenu.svelte'
	import { provideGizmos } from '../../useGizmos.svelte'

	type Storage = ReturnType<typeof provideGizmoStorage>

	interface Props {
		persistenceEnabled?: boolean
		onReady: (ready: {
			gizmos: ReturnType<typeof provideGizmos>
			settings: Settings
			storage: Storage
		}) => void
	}

	const { persistenceEnabled = false, onReady }: Props = $props()

	const settings = $state({ snapping: false } as Settings)
	// Untracked: a harness sets its starting state once and never swaps it mid-test.
	const storage = $state({
		partID: 'test-part',
		enabled: untrack(() => persistenceEnabled),
	} as Storage)

	// Read untracked: the context is established once at setup and a harness never swaps
	// its callback mid-test.
	const gizmos = untrack(() => {
		const ready = provideGizmos(() => undefined)
		onReady({ gizmos: ready, settings, storage })
		return ready
	})
</script>

<button type="button">Outside the menu</button>
<GizmoMenu
	{gizmos}
	{settings}
	{storage}
/>
