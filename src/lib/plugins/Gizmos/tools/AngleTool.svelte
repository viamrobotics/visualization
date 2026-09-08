<!--
@component

Places a three-point angle gizmo: vertex, then the two ray endpoints, named
`angle N`. The entity carries `LinePositions` with the vertex as the middle
point, so it renders through the core `Line` renderer and `GizmoAngleMeasure`
labels its interior angle. Assumes it is only rendered while `useGizmos().mode`
is `'angle'`.
-->
<script lang="ts">
	import { Vector3 } from 'three'

	import { asRGB } from '$lib/buffer'
	import MeasurePoint from '$lib/components/MeasurePoint.svelte'
	import { selectOnly, traits, useWorld } from '$lib/ecs'

	import { cursorPoint } from '../cursor'
	import { cancelPending, confirmPending, POLYLINE_COLOR, spawnPending } from '../spawn'
	import { AngleMeasure } from '../traits'
	import { useGizmos } from '../useGizmos.svelte'
	import { usePending } from '../usePending.svelte'
	import { usePlace } from '../usePlace.svelte'

	const world = useWorld()
	const gizmos = useGizmos()

	/** Confirmed clicks, in click order: vertex, first ray endpoint, second ray endpoint. */
	let placed = $state<Vector3[]>([])

	/**
	 * Flattens the placed points plus an optional live pointer point into the order
	 * `LinePositions` expects: the vertex stays the middle entry once a second point
	 * exists, so the ray from the vertex out to whichever endpoint is still being
	 * placed previews correctly.
	 */
	const toLinePositions = (points: Vector3[], live: Vector3 | undefined) => {
		let ordered: Vector3[]

		if (points.length < 2) {
			ordered = live ? [...points, live] : points
		} else {
			const [vertex, firstEnd] = points
			ordered = live ? [firstEnd!, vertex!, live] : [firstEnd!, vertex!]
		}

		const flat = new Float32Array(ordered.length * 3)
		for (const [i, point] of ordered.entries()) point.toArray(flat, i * 3)
		return flat
	}

	const pending = usePending(() => ({
		onCancel: () => {
			placed = []
			gizmos.exit()
		},
		onUndo: () => {
			if (placed.length === 0) return

			placed = placed.slice(0, -1)
			if (placed.length === 0) {
				cancelPending(pending.current)
				pending.set(undefined)
			}
		},
	}))

	const place = usePlace(() => ({
		findHit: (intersections) => cursorPoint(intersections, pending.current),
		onPlace: (position) => {
			placed = [...placed, position.clone()]

			if (!pending.current) {
				// `LinePositions` stays in world space: the entity keeps the identity
				// matrix `spawnPending` defaults to when no `position`/`matrix` is given.
				pending.set(
					spawnPending(world, {
						kind: 'angle',
						position: new Vector3(),
						traits: [
							traits.LinePositions(toLinePositions(placed, undefined)),
							traits.LineWidth(1.5),
							traits.Color(asRGB(POLYLINE_COLOR, { r: 0, g: 0, b: 0 })),
							AngleMeasure,
						],
					})
				)
				return
			}

			if (placed.length < 3) return

			const entity = pending.current
			confirmPending(entity)
			selectOnly(world, entity)
			pending.set(undefined)
			placed = []
			gizmos.exit()
		},
	}))

	$effect(() => {
		const entity = pending.current
		if (!entity) return

		entity.set(traits.LinePositions, toLinePositions(placed, place.current))
	})
</script>

{#if !pending.current && place.current}
	<MeasurePoint
		position={place.current.toArray()}
		opacity={0.5}
	/>
{/if}
