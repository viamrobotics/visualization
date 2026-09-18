<!--
@component

Renders distance labels along a polyline gizmo's `LinePositions`. `segment` mode labels
each segment at its midpoint; `total` mode labels the running total at the last vertex.
Labels are display-only HTML overlays, opted out of pointer events so they never steal a
click from the tool that is still placing the polyline.
-->
<script
	module
	lang="ts"
>
	/** A point in local or world space, as a plain tuple — see `angle.ts` for why. */
	export type Point3 = readonly [number, number, number]

	export interface PolylineLabel {
		position: Point3
		/** Millimetres, formatted to two decimals — see `PoseDetails.svelte` for the convention. */
		text: string
	}

	const M_TO_MM = 1000

	const distanceBetween = (a: Point3, b: Point3) =>
		Math.sqrt((a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2)

	const midpointOf = (a: Point3, b: Point3): Point3 => [
		(a[0] + b[0]) / 2,
		(a[1] + b[1]) / 2,
		(a[2] + b[2]) / 2,
	]

	const formatMm = (meters: number) => (meters * M_TO_MM).toFixed(2)

	/** The accessible name for a label, since its position over the scene is the only visual cue to what it measures. */
	export const polylineLabelName = (
		mode: 'segment' | 'total',
		segmentIndex: number,
		text: string
	) =>
		mode === 'total'
			? `Total distance: ${text} millimeters`
			: `Segment ${segmentIndex + 1}: ${text} millimeters`

	/** Unpacks a flat `LinePositions` triple array (metres) into points. */
	export const toPoints = (positions: Float32Array): Point3[] => {
		const points: Point3[] = []
		for (let i = 0; i + 2 < positions.length; i += 3) {
			points.push([positions[i] ?? 0, positions[i + 1] ?? 0, positions[i + 2] ?? 0])
		}
		return points
	}

	/**
	 * The labels to render for a set of already-world-transformed points, in metres.
	 * Zero-length segments and a zero-length total are skipped rather than labeled — a
	 * coincident pair of points has no distance worth reporting.
	 */
	export const polylineLabels = (points: Point3[], mode: 'segment' | 'total'): PolylineLabel[] => {
		if (points.length < 2) return []

		if (mode === 'segment') {
			const labels: PolylineLabel[] = []
			for (let i = 0; i + 1 < points.length; i++) {
				const distance = distanceBetween(points[i]!, points[i + 1]!)
				if (distance === 0) continue
				labels.push({ position: midpointOf(points[i]!, points[i + 1]!), text: formatMm(distance) })
			}
			return labels
		}

		let total = 0
		for (let i = 0; i + 1 < points.length; i++) total += distanceBetween(points[i]!, points[i + 1]!)
		if (total === 0) return []

		return [{ position: points.at(-1)!, text: formatMm(total) }]
	}
</script>

<script lang="ts">
	import type { Entity } from 'koota'

	import { HTML } from '@threlte/extras'
	import { Vector3 } from 'three'

	import { traits, useTrait } from '$lib/ecs'

	import { PolylineMeasure } from './traits'

	interface Props {
		entity: Entity
	}

	const { entity }: Props = $props()

	const positions = useTrait(() => entity, traits.LinePositions)
	const worldMatrix = useTrait(() => entity, traits.WorldMatrix)
	const measure = useTrait(() => entity, PolylineMeasure)

	const worldPoint = new Vector3()

	const worldPoints = $derived.by((): Point3[] => {
		if (!positions.current) return []

		return toPoints(positions.current).map((point) => {
			worldPoint.set(point[0], point[1], point[2])
			if (worldMatrix.current) worldPoint.applyMatrix4(worldMatrix.current)
			return [worldPoint.x, worldPoint.y, worldPoint.z]
		})
	})

	const labels = $derived(polylineLabels(worldPoints, measure.current?.mode ?? 'segment'))
</script>

{#each labels as { position, text }, i (i)}
	<HTML
		center
		position={position as unknown as [number, number, number]}
		zIndexRange={[3, 0]}
	>
		<div
			role="group"
			aria-label={polylineLabelName(measure.current?.mode ?? 'segment', i, text)}
			class="font-roboto-mono pointer-events-none border border-black bg-white px-1 py-0.5 text-xs"
		>
			{text}<span class="text-subtle-2">mm</span>
		</div>
	</HTML>
{/each}
