<!--
@component

`LineTool` reads `useGizmos()` and `useSettings()` (both private context keys) plus
`useWorld()`, none of which a spec can inject through `render`'s `context` map, so this
host stands all three up and hands the world back through `onReady`. Mirrors
`UsePendingHost`, which does the same for `usePending` alone.
-->
<script lang="ts">
	import type { World } from 'koota'

	import { untrack } from 'svelte'

	import { provideWorld, useWorld } from '$lib/ecs'
	import { provideSettings } from '$lib/hooks/useSettings.svelte'

	import type { LineMeasure, LineSpace } from '../../gizmos'

	import { GizmoModes } from '../../gizmos'
	import LineTool from '../../tools/LineTool.svelte'
	import { provideGizmos } from '../../useGizmos.svelte'

	interface Props {
		lineSpace?: LineSpace
		lineMeasure?: LineMeasure
		vertexSnapDistance?: number
		snapping?: boolean
		/** Handed the world the host provided, once, during init. */
		onReady: (world: World) => void
	}

	const {
		lineSpace = 'world',
		lineMeasure = 'none',
		vertexSnapDistance = 50,
		snapping = false,
		onReady,
	}: Props = $props()

	provideWorld()
	const gizmos = provideGizmos(() => undefined)
	const settings = provideSettings()

	untrack(() => {
		gizmos.mode = GizmoModes.Polyline
		gizmos.lineSpace = lineSpace
		gizmos.lineMeasure = lineMeasure
		gizmos.vertexSnapDistance = vertexSnapDistance
		settings.merge({ ...settings.current, snapping })

		onReady(useWorld())
	})
</script>

<LineTool />
