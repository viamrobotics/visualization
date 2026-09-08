<!--
@component

Places a reference-geometry gizmo at a single click: a box, sphere, or capsule
entity, named `reference box N`, `reference sphere N`, or `reference capsule
N`. Honours `geometryPlacement`: `'at-origin'` ignores the clicked point and
places at the world origin. Assumes it is only rendered while
`useGizmos().mode` is `'reference-geometry'`.
-->
<script lang="ts">
	import type { Entity } from 'koota'

	import { onDestroy } from 'svelte'
	import { Vector3 } from 'three'

	import { asRGB } from '$lib/buffer'
	import MeasurePoint from '$lib/components/MeasurePoint.svelte'
	import { selectOnly, traits, useWorld } from '$lib/ecs'

	import { cursorPoint } from '../cursor'
	import {
		cancelPending,
		confirmPending,
		REFERENCE_GEOMETRY_COLOR,
		REFERENCE_GEOMETRY_OPACITY,
		spawnPending,
	} from '../spawn'
	import { useGizmoInputs } from '../useGizmoInputs.svelte'
	import { useGizmos } from '../useGizmos.svelte'
	import { usePlace } from '../usePlace.svelte'

	const world = useWorld()
	const gizmos = useGizmos()

	const origin = new Vector3(0, 0, 0)

	// Tracked so an unmount between spawning and confirming (e.g. the user cancels
	// mid-click) destroys the pending entity rather than leaving it behind.
	let pending: Entity | undefined

	const place = usePlace(() => ({
		findHit: cursorPoint,
		onPlace: (position) => {
			const shapeTrait = gizmos.geometryTrait
			if (!shapeTrait) return

			pending = spawnPending(world, {
				kind: `reference ${gizmos.referenceShape}`,
				position: gizmos.geometryPlacement === 'at-origin' ? origin : position,
				traits: [
					shapeTrait,
					traits.Color(asRGB(REFERENCE_GEOMETRY_COLOR, { r: 0, g: 0, b: 0 })),
					traits.Opacity(REFERENCE_GEOMETRY_OPACITY),
					...(gizmos.isWireframe ? [traits.Wireframe] : []),
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
