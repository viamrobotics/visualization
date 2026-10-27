<script lang="ts">
	import { T, useTask, useThrelte } from '@threlte/core'
	import { View } from '@threlte/extras'
	import { type Entity } from 'koota'
	import { Matrix4, PerspectiveCamera } from 'three'

	import { traits } from '$lib/ecs'

	interface Props {
		entity: Entity
	}

	const { entity }: Props = $props()

	const { scene, renderStage } = useThrelte()

	// Three.js cameras look down -Z. Viam camera frames put the optical axis along
	// +Z with image-down along +Y, so a 180° rotation around X aligns the render
	// with what a sensor at this frame would see.
	const VIAM_TO_THREE_CAMERA = new Matrix4().makeRotationX(Math.PI)

	const FOV_DEG = 60

	const camera = new PerspectiveCamera(FOV_DEG, 1, 0.01, 1000)
	camera.up.set(0, 0, 1)

	let viewEl = $state.raw<HTMLDivElement>()

	const composed = new Matrix4()

	useTask(
		() => {
			if (!viewEl) return
			const worldMat = entity.get(traits.WorldMatrix)
			if (!worldMat) return

			if (viewEl.clientWidth <= 0 || viewEl.clientHeight <= 0) return

			composed.multiplyMatrices(worldMat, VIAM_TO_THREE_CAMERA)
			composed.decompose(camera.position, camera.quaternion, camera.scale)

			camera.updateProjectionMatrix()
			camera.updateMatrixWorld(true)
		},
		{ stage: renderStage, autoInvalidate: false }
	)
</script>

<div
	bind:this={viewEl}
	class="absolute inset-0 block h-full w-full"
></div>

<View
	dom={viewEl}
	{scene}
>
	<T
		is={camera}
		makeDefault
	/>
</View>
