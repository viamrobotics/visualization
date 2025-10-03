<script lang="ts">
	import { T, useTask, useThrelte } from '@threlte/core'
	import {
		Points,
		PointsMaterial,
		BufferGeometry,
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

	const pointSize = $derived(object.metadata?.pointSize ?? settings.current.pointSize)

	$effect.pre(() => {
		material.size = pointSize
	})

	let geometry = $state.raw<BufferGeometry>()
	let interleaved: InterleavedBuffer | undefined
	let hasPosition = $state(false)

	const headers = $derived(object.geometry?.value.header)
	const data = $derived(object.geometry?.value.pointCloud)

	$effect.pre(() => {
		if (object.pose) {
			poseToObject3d(object.pose, points)
		}
	})

	// Build initial geometry when a full payload exists
	$effect(() => {
		if (!headers || !data) return
		if (geometry) return // already built; avoid repeated full rebuilds on unrelated updates

		try {
			const built = buildPointCloud(data, headers)
			geometry = built.buffer
			interleaved = built.interleaved
			geometry.computeBoundingSphere()
		} catch (e) {
			console.error('Failed to build point cloud geometry', e)
			return
		}

		// Enable vertex colors automatically if present
		const hasColor = !!geometry.getAttribute('color')
		material.vertexColors = hasColor
		if (!hasColor) {
			material.color.set(0x000000)
		}
		// Defer enabling BVH until geometry is attached to the points object (next frame)
		hasPosition = false
		requestAnimationFrame(() => {
			const attached = points.geometry as BufferGeometry | undefined
			hasPosition = !!attached?.getAttribute?.('position')
		})

		// Clear any queued updates since we just built from the latest full data
		object.drainUpdates()
	})

	// Drain and apply queued updates every frame (renderer-side batching)
	useTask(() => {
		if (!object) return
		const updates = object.drainUpdates()
		if (!updates || updates.length === 0) return

		if (!interleaved) {
			// No current buffer; try to build if a full update exists
			const full = updates.find((u) => !u.header || u.header.start === undefined)
			if (full && (headers || full.header)) {
				const header = (full.header ?? headers)!
				try {
					const built = buildPointCloud(full.data, header)
					geometry = built.buffer
					interleaved = built.interleaved
					geometry.computeBoundingSphere()
				} catch (e) {
					console.error('Failed to build point cloud geometry (full)', e)
					return
				}
				if (!geometry) return
				const hasColor = !!geometry.getAttribute('color')
				material.vertexColors = hasColor
				if (!hasColor) material.color.set(0xffffff)
				hasPosition = false
				requestAnimationFrame(() => {
					const attached = points.geometry as BufferGeometry | undefined
					hasPosition = !!attached?.getAttribute?.('position')
				})
			}
		}

		if (!interleaved) return

		for (const u of updates) {
			// Apply partials; fulls rebuild
			if (!u.header || u.header.start === undefined) {
				const header = u.header ?? headers
				if (!header) continue
				try {
					const built = buildPointCloud(u.data, header)
					geometry = built.buffer
					interleaved = built.interleaved
					geometry.computeBoundingSphere()
				} catch (e) {
					console.error('Failed to rebuild point cloud geometry (full in updates)', e)
					continue
				}
				if (!geometry) continue
				const hasColor = !!geometry.getAttribute('color')
				material.vertexColors = hasColor
				if (!hasColor) material.color.set(0x000000)
				hasPosition = false
				requestAnimationFrame(() => {
					const attached = points.geometry as BufferGeometry | undefined
					hasPosition = !!attached?.getAttribute?.('position')
				})
			} else {
				// Partial update path: update interleaved buffer in place
				updatePointCloud(interleaved, u.data, u.header)

				// Mark position attribute for GPU upload
				const posAttr = geometry?.getAttribute('position')
				if (posAttr) {
					posAttr.needsUpdate = true
				}

				// Also refresh colors for the updated range if we have a color attribute
				const colorAttr = geometry?.getAttribute('color') as import('three').BufferAttribute
				if (colorAttr) {
					const start = u.header.start ?? 0
					const count = (u.header.width || 0) * (u.header.height || 1)
					if (count > 0) {
						updatePointCloudColors(interleaved, headers, start, count, colorAttr)
					}
				}
			}
		}
	})

	// Make points scale consistent in orthographic (respect metadata-defined pointSize)
	useTask(
		() => {
			const cam = camera.current as OrthographicCamera | undefined
			if (cam) material.size = pointSize * (cam.zoom / 2)
		},
		{ autoStart: true }
	)
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
