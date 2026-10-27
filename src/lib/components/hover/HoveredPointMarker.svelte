<script
	module
	lang="ts"
>
	/**
	 * Relative to the cloud's own point size, so the marker reads as the same point drawn slightly
	 * larger rather than as a blob covering its neighbours.
	 */
	export const MARKER_SCALE = 1.6
</script>

<script lang="ts">
	import type { Entity } from 'koota'

	import { T, useTask, useThrelte } from '@threlte/core/webgpu'
	import { BufferAttribute, BufferGeometry, type OrthographicCamera } from 'three'

	import { traits, useTrait } from '$lib/ecs'
	import { useSettings } from '$lib/hooks/useSettings.svelte'
	import { PointCloud } from '$lib/three/PointCloud'

	interface Props {
		entity: Entity
	}

	let { entity }: Props = $props()

	const { camera, invalidate } = useThrelte()
	const settings = useSettings()

	const instanced = useTrait(() => entity, traits.InstancedMatrix)
	const entityPointSize = useTrait(() => entity, traits.PointSize)

	// Mirrors `Entities/Points.svelte`, so the marker tracks whatever size the cloud is drawn at.
	const pointSize = $derived(
		(entityPointSize.current
			? entityPointSize.current * 0.001
			: Number(settings.current.pointSize)) * MARKER_SCALE
	)
	const orthographic = $derived(settings.current.cameraMode === 'orthographic')

	const geometry = new BufferGeometry()
	geometry.setAttribute('position', new BufferAttribute(new Float32Array(3), 3))

	const marker = new PointCloud(geometry)
	marker.matrixAutoUpdate = false
	marker.renderOrder = 999

	const { material } = marker
	// `power-wire`
	material.color.set(0xff_00_47)
	material.depthTest = false
	material.depthWrite = false
	material.toneMapped = false

	$effect(() => {
		return () => geometry.dispose()
	})

	// Orthographic size is driven per frame by the task below, which reads a zoom that isn't
	// reactive. Writing it here too would clobber that between frames.
	$effect(() => {
		if (!orthographic) {
			marker.size.value = pointSize
			invalidate()
		}
	})

	$effect(() => {
		marker.isPerspective.value = orthographic ? 0 : 1
		invalidate()
	})

	$effect(() => {
		// Scaled by the same factor as the size, so the marker stays larger than the cloud even
		// where the cloud is already pinned to the clamp.
		marker.maxSize.value = Number(settings.current.maxPointSize) * MARKER_SCALE
		invalidate()
	})

	$effect(() => {
		if (!instanced.current) return

		marker.matrix.copy(instanced.current.matrix)
		marker.updateMatrixWorld()

		invalidate()
	})

	useTask(
		() => {
			marker.size.value = pointSize * ((camera.current as OrthographicCamera).zoom / 2)
		},
		{
			running: () => orthographic,
			autoInvalidate: false,
		}
	)
</script>

<T
	is={marker}
	bvh={{ enabled: false }}
/>
