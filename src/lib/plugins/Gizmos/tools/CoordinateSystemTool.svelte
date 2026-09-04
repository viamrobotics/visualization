<!--
@component

Places a coordinate-system gizmo at a single click: a `ReferenceFrame` entity
with its axes shown, named `coordinate system N`. Assumes it is only rendered
while `useGizmos().mode` is `'coordinate-system'`.
-->
<script lang="ts">
	import type { Entity } from 'koota'

	import { onDestroy } from 'svelte'

	import MeasurePoint from '$lib/components/MeasurePoint.svelte'
	import { selectOnly, traits, useWorld } from '$lib/ecs'

	import { cursorPoint } from '../cursor'
	import { cancelPending, confirmPending, spawnPending } from '../spawn'
	import { useGizmoInputs } from '../useGizmoInputs.svelte'
	import { useGizmos } from '../useGizmos.svelte'
	import { usePlace } from '../usePlace.svelte'

	const world = useWorld()
	const gizmos = useGizmos()

	// Tracked so an unmount between spawning and confirming (e.g. the user cancels
	// mid-click) destroys the pending entity rather than leaving it behind.
	let pending: Entity | undefined

	const place = usePlace(() => ({
		findHit: cursorPoint,
		onPlace: (position) => {
			pending = spawnPending(world, {
				kind: 'coordinate system',
				position,
				traits: [traits.ReferenceFrame, traits.ShowAxesHelper],
			})
			confirmPending(pending)
			selectOnly(world, pending)
			pending = undefined

			gizmos.exit()
		},
	}))

	useGizmoInputs({
		onCancel: () => gizmos.exit(),
	})

	onDestroy(() => cancelPending(pending))
</script>

{#if place.current}
	<MeasurePoint
		position={place.current.toArray()}
		opacity={0.5}
	/>
{/if}
