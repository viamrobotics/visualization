<!--
@component

One camera's view frustum, drawn as a wireframe pinned to the camera frame's world pose.

The geometry arrives already expressed in the camera frame's own coordinates, so the
frame's `WorldMatrix` is the whole transform — the same pattern `Line.svelte` uses, and
the reason the matrix is copied rather than decomposed into props.
-->
<script lang="ts">
	import type { Entity } from 'koota'

	import { T, useThrelte } from '@threlte/core'
	import { LineMaterial } from 'three/addons/lines/LineMaterial.js'
	import { LineSegments2 } from 'three/addons/lines/LineSegments2.js'
	import { LineSegmentsGeometry } from 'three/addons/lines/LineSegmentsGeometry.js'

	import { traits, useTrait } from '$lib/ecs'

	interface Props {
		entity: Entity

		/** Line-segment endpoints from `frustumPositions`. */
		positions: Float32Array
	}

	const { entity, positions }: Props = $props()

	/** Screen-space width, in pixels. Matches the selection outline's weight. */
	const LINE_WIDTH = 2

	/** Dialled back so a frustum reads as an annotation over the scene, not part of it. */
	const OPACITY = 0.85

	/** Used for a frame carrying no colour of its own. */
	const FALLBACK_COLOR = { r: 0.4, g: 0.4, b: 0.4 }

	const { invalidate } = useThrelte()

	const name = useTrait(() => entity, traits.Name)
	const worldMatrix = useTrait(() => entity, traits.WorldMatrix)
	const color = useTrait(() => entity, traits.Color)
	const invisible = useTrait(() => entity, traits.InheritedInvisible)

	const geometry = new LineSegmentsGeometry()
	const material = new LineMaterial({
		linewidth: LINE_WIDTH,
		opacity: OPACITY,
		transparent: true,
	})
	const lines = new LineSegments2(geometry, material)
	lines.matrixAutoUpdate = false

	$effect(() => {
		geometry.setPositions(positions)
		invalidate()
	})

	$effect(() => {
		const { r, g, b } = color.current ?? FALLBACK_COLOR
		material.color.setRGB(r, g, b)
		invalidate()
	})

	$effect(() => {
		if (!worldMatrix.current) return
		lines.matrix.copy(worldMatrix.current)
		lines.updateMatrixWorld()
		invalidate()
	})
</script>

<T
	is={lines}
	name={entity}
	userData.name={name.current}
	dispose={false}
	raycast={() => null}
	visible={invisible.current !== true}
>
	<T is={geometry} />
	<T is={material} />
</T>
