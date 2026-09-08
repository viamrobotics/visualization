<!--
@component

Renders the interior angle, in degrees, for an angle gizmo's `LinePositions`. The trait's
own comment establishes the shape: exactly three points, angle measured at the middle
vertex. The label is a display-only HTML overlay, opted out of pointer events so it never
steals a click from the tool that is still placing the angle.
-->
<script lang="ts">
	import type { Entity } from 'koota'

	import { HTML } from '@threlte/extras'
	import { Vector3 } from 'three'

	import { traits, useTrait } from '$lib/ecs'

	import { interiorAngle, type Point3 } from './angle'

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

		const a = toWorldPoint(flat[0]!, flat[1]!, flat[2]!)
		const vertex = toWorldPoint(flat[3]!, flat[4]!, flat[5]!)
		const b = toWorldPoint(flat[6]!, flat[7]!, flat[8]!)

		return { position: vertex, degrees: interiorAngle(a, vertex, b) }
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
			aria-label={`Angle: ${angle.degrees.toFixed(2)} degrees`}
			class="pointer-events-none border border-black bg-white px-1 py-0.5 text-xs"
		>
			{angle.degrees.toFixed(2)}<span class="text-subtle-2">&deg;</span>
		</div>
	</HTML>
{/if}
