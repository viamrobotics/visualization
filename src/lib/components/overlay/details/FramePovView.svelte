<script lang="ts">
	import { T, useTask, useThrelte } from '@threlte/core/webgpu'
	import { View } from '@threlte/extras/webgpu'
	import { type Entity } from 'koota'
	import { Matrix4, PerspectiveCamera } from 'three'

	import { verticalFovDegrees } from '#lib/cameraIntrinsics.js'
	import { traits, useTrait } from '#lib/ecs/index.js'

	interface Props {
		entity: Entity
	}

	const { entity }: Props = $props()

	const { scene, renderStage, invalidate } = useThrelte()

	const cameraTrait = useTrait(() => entity, traits.Camera)
	const intrinsics = $derived(cameraTrait.current?.intrinsics)

	// Three.js cameras look down -Z. Viam camera frames put the optical axis along
	// +Z with image-down along +Y, so a 180° rotation around X aligns the render
	// with what a sensor at this frame would see.
	const VIAM_TO_THREE_CAMERA = new Matrix4().makeRotationX(Math.PI)

	/** Used for any frame that is not a camera reporting usable intrinsics. */
	const APPROXIMATE_FOV_DEG = 60

	const fov = $derived(intrinsics ? verticalFovDegrees(intrinsics) : APPROXIMATE_FOV_DEG)

	const camera = new PerspectiveCamera(APPROXIMATE_FOV_DEG, 1, 0.01, 1000)
	camera.up.set(0, 0, 1)

	$effect(() => {
		camera.fov = fov
		camera.updateProjectionMatrix()
		invalidate()
	})

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

<p
	class="text-subtle-1 pointer-events-none absolute right-1 bottom-1 z-1 rounded bg-white/80 px-1 text-xs"
>
	{intrinsics
		? `FOV ${Math.round(fov)}° from camera intrinsics`
		: `Approximate view, ${APPROXIMATE_FOV_DEG}° FOV`}
</p>

<View
	dom={viewEl}
	{scene}
>
	<T
		is={camera}
		makeDefault
	/>
</View>
