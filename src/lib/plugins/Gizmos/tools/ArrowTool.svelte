<!--
@component

Places a direction-arrow gizmo at a single click: a `traits.Arrow` entity oriented to
`gizmos.arrowAxis`, either a world axis or the clicked surface's normal. Named `arrow N`.
Assumes it is only rendered while `useGizmos().mode` is `'arrow'`.
-->
<script lang="ts">
	import type { Entity } from 'koota'

	import { onDestroy } from 'svelte'

	import { asRGB } from '$lib/buffer'
	import MeasurePoint from '$lib/components/MeasurePoint.svelte'
	import { selectOnly, traits, useWorld } from '$lib/ecs'

	import { cursorHit } from '../cursor'
	import { arrowMatrix } from '../matrix'
	import { ARROW_COLOR, cancelPending, confirmPending, spawnPending } from '../spawn'
	import { useGizmoInputs } from '../useGizmoInputs.svelte'
	import { useGizmos } from '../useGizmos.svelte'
	import { usePlace } from '../usePlace.svelte'

	const world = useWorld()
	const gizmos = useGizmos()

	// Tracked so an unmount between spawning and confirming (e.g. the user cancels
	// mid-click) destroys the pending entity rather than leaving it behind.
	let pending: Entity | undefined

	const place = usePlace(() => ({
		findHit: cursorHit,
		onPlace: ({ position, normal }) => {
			pending = spawnPending(world, {
				kind: 'arrow',
				position,
				matrix: arrowMatrix(gizmos.arrowAxis, position, normal),
				traits: [traits.Arrow, traits.Color(asRGB(ARROW_COLOR, { r: 0, g: 0, b: 0 }))],
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
		position={place.current.position.toArray()}
		opacity={0.5}
	/>
{/if}
