<script lang="ts">
	import { BatchedArrow } from '$lib/three/BatchedArrow'
	import type { ArrowsGeometry, WorldObject } from '$lib/WorldObject.svelte'
	import { T } from '@threlte/core'
	import { Color, Vector3 } from 'three'
	import Geometry from '../Geometry.svelte'

	interface Props {
		geometries: WorldObject[]
		arrows: WorldObject<ArrowsGeometry>[]
	}

	let { geometries, arrows }: Props = $props()

	const batchedArrow = new BatchedArrow()
	const origin = new Vector3()
	const direction = new Vector3()
	const color = new Color()

	const arrowLength = 0.1
	const arrowHeadAtPose = true

	$effect(() => {
		batchedArrow.clear()

		arrows.forEach((arrow) => {
			if (!arrow.geometry) return

			const arrowData = arrow.geometry.geometryType
			if (arrowData.case !== 'arrows') return

			const { poses: posesBytes, colorCount, colors: colorsBytes } = arrowData.value

			const poses = new Float32Array(
				posesBytes.buffer,
				posesBytes.byteOffset,
				posesBytes.byteLength / 4
			)
			const colors = new Float32Array(
				colorsBytes.buffer,
				colorsBytes.byteOffset,
				colorsBytes.byteLength / 4
			)

			const singleColor = colorCount === 1

			if (singleColor) {
				color.setRGB(colors[0], colors[1], colors[2])
			}

			for (let i = 0; i < poses.length; i += 6) {
				origin.set(poses[i], poses[i + 1], poses[i + 2]).multiplyScalar(0.001)
				direction.set(poses[i + 3], poses[i + 4], poses[i + 5])

				if (!singleColor) {
					const colorIndex = (i / 6) * 3
					color.setRGB(colors[colorIndex], colors[colorIndex + 1], colors[colorIndex + 2])
				}

				batchedArrow.addArrow(direction, origin, arrowLength, color, arrowHeadAtPose)
			}
		})
	})
</script>

{#each geometries as object (object.uuid)}
	<Geometry
		uuid={object.uuid}
		name={object.name}
		color={`#${object.metadata.color?.getHexString() ?? '00ff00'}`}
		pose={object.pose}
		geometry={object.geometry}
		metadata={object.metadata}
	/>
{/each}

<T
	name={batchedArrow.object3d.name}
	is={batchedArrow.object3d}
	dispose={false}
/>
