<script lang="ts">
	import { T, useTask, useThrelte } from '@threlte/core'
	import {
		Points,
		PointsMaterial,
		BufferGeometry,
		BufferAttribute,
		OrthographicCamera,
		InterleavedBuffer,
	} from 'three'
	import { poseToObject3d } from '$lib/transform'
	import type { PointCloudWorldObject } from '$lib/WorldObject.svelte'
	import { buildPointCloud, updatePointCloudColors, updatePointCloud } from '$lib/point-cloud'
	import { useSettings } from '$lib/hooks/useSettings.svelte'

	interface Props {
		object: PointCloudWorldObject
	}

	let { object }: Props = $props()

	const { camera } = useThrelte()
	const settings = useSettings()

	const points = new Points()
	const material = new PointsMaterial()
	material.toneMapped = false

	let geometry = $state.raw<BufferGeometry>()
	let interleaved: InterleavedBuffer | undefined
	let colorFieldOffset: number | undefined
	let hasPosition = $state(false)

	const pointCloud = $derived(object.physicalObject.geometryType.value.pointCloud)
	const headers = $derived(object.physicalObject.geometryType.value.header)
	const pointSize = $derived(object.metadata?.pointSize ?? settings.current.pointSize)
	const orthographic = $derived(settings.current.cameraMode === 'orthographic')

	const rebuildGeometry = (data: Uint8Array, header: typeof headers): boolean => {
		try {
			const built = buildPointCloud(data, header)
			geometry?.dispose()
			geometry = built.buffer
			interleaved = built.interleaved
			colorFieldOffset = built.colorFieldOffset
			geometry.boundingSphere = null
		} catch (e) {
			console.error(`Failed to build point cloud geometry`, e)
			return false
		}

		if (!geometry) return false

		const hasColor = geometry.hasAttribute('color')
		material.vertexColors = hasColor
		if (!hasColor) material.color.set(0x000000)

		hasPosition = false
		requestAnimationFrame(() => {
			const attached = points.geometry
			hasPosition = attached?.hasAttribute?.('position') ?? false
		})

		return true
	}

	$effect.pre(() => {
		if (object.pose) {
			poseToObject3d(object.pose, points)
		}
	})

	$effect(() => {
		if (!pointCloud || !headers) return
		if (geometry) return
		if (!rebuildGeometry(pointCloud, headers)) return
		object.drainUpdates()
	})

	useTask(() => {
		if (!object) return

		const updates = object.drainUpdates()
		if (!updates || updates.length === 0) return
		if (!interleaved) {
			const full = updates.find(({ header }) => !header || header.start === undefined)
			if (!full) return
			if (!full.header && !headers) return
			if (!rebuildGeometry(full.data, full.header ?? headers)) return
		}

		if (!interleaved) return
		for (const update of updates) {
			if (!update.header || update.header.start === undefined) {
				if (!update.header && !headers) continue
				if (!rebuildGeometry(update.data, update.header ?? headers)) continue
			} else {
				updatePointCloud(interleaved, update.data, update.header)
				if (geometry) geometry.boundingSphere = null

				const start = update.header.start ?? 0
				const count = (update.header.width || 0) * (update.header.height || 1)
				const colors = geometry?.getAttribute('color') as BufferAttribute
				if (colors && count > 0) {
					updatePointCloudColors(interleaved, colorFieldOffset, start, count, colors)
				}
			}
		}
	})

	const { start: startOrthographicTask, stop: stopOrthographicTask } = useTask(
		() => {
			const cam = camera.current as OrthographicCamera | undefined
			if (cam) material.size = pointSize * (cam.zoom / 2)
		},
		{ autoStart: false }
	)

	$effect(() => {
		if (orthographic) {
			startOrthographicTask()
		} else {
			stopOrthographicTask()
			material.size = pointSize
		}
	})

	$effect(() => {
		return () => {
			geometry?.dispose()
			material.dispose()
		}
	})
</script>

<T
	is={points}
	name={object.name}
	uuid={object.uuid}
	bvh={hasPosition ? { maxDepth: 40, maxLeafTris: 20 } : { enabled: false }}
>
	{#if geometry}
		<T is={geometry} />
	{/if}
	<T is={material} />
</T>
