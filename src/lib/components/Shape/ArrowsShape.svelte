<!--

This component is consumed as a library export
and should remain pure, i.e. no hooks should be used.

-->
<script lang="ts">
	import { T } from '@threlte/core'
	import { Color, Vector3 } from 'three'
	import type { WorldObject } from '$lib/WorldObject.svelte'
	import { useArrows } from '$lib/hooks/useArrows.svelte'
	import { RGBA_FIELDS } from '$lib/color'
	import type { ArrowsGeometry } from '$lib/shape'
	import { parseArrowsBuffer } from '$lib/arrows'

	interface Props {
		geometry: ArrowsGeometry
		metadata: WorldObject['metadata']
	}

	let { geometry, metadata }: Props = $props()

	const batchedArrow = useArrows()

	const length = 0.1
	const headAtPose = true
	const color = new Color()
	const origin = new Vector3()
	const direction = new Vector3()

	$effect(() => {
		// Parse arrows pose data (position + orientation vector)
		const { poseData, colorData, poses, colors } = parseArrowsBuffer(geometry, metadata)
		const hasColorPerArrow = colors > 1
		if (!hasColorPerArrow) {
			color.setRGB(colorData[0], colorData[1], colorData[2])
		}

		for (let i = 0; i < poses; i++) {
			const poseIdx = i * 6
			origin.set(poseData[poseIdx], poseData[poseIdx + 1], poseData[poseIdx + 2])
			direction.set(poseData[poseIdx + 3], poseData[poseIdx + 4], poseData[poseIdx + 5])

			if (hasColorPerArrow) {
				const colorIdx = i * RGBA_FIELDS.length
				color.setRGB(colorData[colorIdx], colorData[colorIdx + 1], colorData[colorIdx + 2])
			}

			batchedArrow.addArrow(direction, origin, length, color, headAtPose)
		}
	})
</script>

<T
	name={batchedArrow.object3d.name}
	is={batchedArrow.object3d}
	dispose={false}
	bvh={{ enabled: false }}
/>
