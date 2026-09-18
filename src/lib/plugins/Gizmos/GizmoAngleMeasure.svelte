<!--
@component

Renders the interior angle, in degrees, for an angle gizmo's `LinePositions`. The trait's
own comment establishes the shape: exactly three points, angle measured at the middle
vertex. The label is a display-only HTML overlay, opted out of pointer events so it never
steals a click from the tool that is still placing the angle.
-->
<script
	module
	lang="ts"
>
	import { interiorAngle, type Point3 } from './angle'

	export interface AngleLabel {
		position: Point3
		degrees: number
	}

	/** Below this ray length, a and vertex (or b and vertex) are treated as coincident. */
	const COINCIDENT_EPSILON = 1e-9

	const distanceBetween = (a: Point3, b: Point3) =>
		Math.sqrt((a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2)

	/** The accessible name for the angle label, since its position over the scene is the only visual cue to what it measures. */
	export const angleLabelName = (degrees: number) => `Angle: ${degrees.toFixed(2)} degrees`

	/**
	 * The label to render for three already-world-transformed points, in metres. Fewer than
	 * three points, or either ray from the vertex having (near) zero length, produces no
	 * label, since a coincident pair of points has no angle worth reporting.
	 */
	export const angleLabel = (points: Point3[]): AngleLabel | undefined => {
		if (points.length < 3) return undefined

		const [a, vertex, b] = points as [Point3, Point3, Point3]
		if (
			distanceBetween(a, vertex) < COINCIDENT_EPSILON ||
			distanceBetween(vertex, b) < COINCIDENT_EPSILON
		)
			return undefined

		return { position: vertex, degrees: interiorAngle(a, vertex, b) }
	}
</script>

<script lang="ts">
	import type { Entity } from 'koota'

	import { HTML } from '@threlte/extras'
	import { Vector3 } from 'three'

	import { traits, useTrait } from '$lib/ecs'

	interface Props {
		entity: Entity
	}

	const { entity }: Props = $props()

	const positions = useTrait(() => entity, traits.LinePositions)
	const worldMatrix = useTrait(() => entity, traits.WorldMatrix)

	const worldPoint = new Vector3()

	const toWorldPoint = (x: number, y: number, z: number): Point3 => {
		worldPoint.set(x, y, z)
		if (worldMatrix.current) worldPoint.applyMatrix4(worldMatrix.current)
		return [worldPoint.x, worldPoint.y, worldPoint.z]
	}

	const angle = $derived.by(() => {
		const flat = positions.current
		if (!flat || flat.length < 9) return undefined

		return angleLabel([
			toWorldPoint(flat[0]!, flat[1]!, flat[2]!),
			toWorldPoint(flat[3]!, flat[4]!, flat[5]!),
			toWorldPoint(flat[6]!, flat[7]!, flat[8]!),
		])
	})
</script>

{#if angle}
	<HTML
		center
		position={angle.position as unknown as [number, number, number]}
		zIndexRange={[3, 0]}
	>
		<div
			role="group"
			aria-label={angleLabelName(angle.degrees)}
			class="font-roboto-mono pointer-events-none border border-black bg-white px-1 py-0.5 text-xs"
		>
			{angle.degrees.toFixed(2)}<span class="text-subtle-2">&deg;</span>
		</div>
	</HTML>
{/if}
