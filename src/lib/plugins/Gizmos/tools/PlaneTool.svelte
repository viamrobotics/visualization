<!--
@component

Places a reference-plane gizmo at a single click, oriented to `planeAxis`,
named `reference plane N`. Honours `planePlacement`: `'offset'` shifts the
plane along its own normal by `planeOffset` (mm) from the clicked point.
Assumes it is only rendered while `useGizmos().mode` is `'reference-plane'`.
-->
<script lang="ts">
	import type { Entity } from 'koota'

	import { onDestroy } from 'svelte'

	import { asRGB } from '$lib/buffer'
	import MeasurePoint from '$lib/components/MeasurePoint.svelte'
	import { selectOnly, traits, useWorld } from '$lib/ecs'

	import { cursorPoint } from '../cursor'
	import { planeMatrix } from '../matrix'
	import {
		cancelPending,
		confirmPending,
		REFERENCE_GEOMETRY_COLOR,
		REFERENCE_GEOMETRY_OPACITY,
		spawnPending,
	} from '../spawn'
	import { ReferencePlane } from '../traits'
	import { useGizmoInputs } from '../useGizmoInputs.svelte'
	import { useGizmos } from '../useGizmos.svelte'
	import { usePlace } from '../usePlace.svelte'

	// composeBoxMatrix.ts uses the same conversion for mm-scale traits placed in scene units.
	const MM_TO_M = 0.001

	const world = useWorld()
	const gizmos = useGizmos()

	// Tracked so an unmount between spawning and confirming (e.g. the user cancels
	// mid-click) destroys the pending entity rather than leaving it behind.
	let pending: Entity | undefined

	const place = usePlace(() => ({
		findHit: cursorPoint,
		onPlace: (position) => {
			const placedPosition =
				gizmos.planePlacement === 'offset'
					? position.clone().addScaledVector(gizmos.planeAxisVector, gizmos.planeOffset * MM_TO_M)
					: position

			pending = spawnPending(world, {
				kind: 'reference plane',
				position: placedPosition,
				matrix: planeMatrix(gizmos.planeAxis, placedPosition),
				traits: [
					ReferencePlane({ axis: gizmos.planeAxis }),
					traits.Color(asRGB(REFERENCE_GEOMETRY_COLOR, { r: 0, g: 0, b: 0 })),
					traits.Opacity(REFERENCE_GEOMETRY_OPACITY),
					traits.ShowAxesHelper,
				],
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
