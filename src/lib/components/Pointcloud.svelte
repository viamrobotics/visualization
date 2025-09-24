<script lang="ts">
	import {
		Points,
		BufferAttribute,
		BufferGeometry,
		PointsMaterial,
		OrthographicCamera,
		DynamicDrawUsage,
	} from 'three'
	import { T, useTask, useThrelte } from '@threlte/core'
	import type { PointsGeometry, WorldObject } from '$lib/WorldObject.svelte'
	import { useObjectEvents } from '$lib/hooks/useObjectEvents.svelte'
	import { poseToObject3d } from '$lib/transform'
	import { useSettings } from '$lib/hooks/useSettings.svelte'
	import type { Snippet } from 'svelte'
	import { isEqual } from 'lodash-es'
	interface Props {
		object: WorldObject<PointsGeometry>
		children?: Snippet
	}

	let { object, children }: Props = $props()

	const { camera } = useThrelte()
	const settings = useSettings()

	const colors = $derived(object.metadata.colors)
	const pointSize = $derived(object.metadata.pointSize ?? settings.current.pointSize)
	const positions = $derived(object.geometry?.value ?? new Float32Array())
	const orthographic = $derived(settings.current.cameraMode === 'orthographic')

	// Colors are working correctly - debug logs removed

	// Force reactivity trigger for in-place updates
	const updateVersion = $derived(object.updateVersion || 0)

	// Animation working - debug logs removed

	const points = new Points()
	const geometry = new BufferGeometry()
	const material = new PointsMaterial()
	material.toneMapped = false

	// Disable frustum culling to ensure point cloud is always rendered during updates
	points.frustumCulled = false

	// Create reusable BufferAttributes for efficient updates
	let positionAttribute: BufferAttribute | null = null
	let colorAttribute: BufferAttribute | null = null

	// Optimize for dynamic updates by setting usage to DynamicDrawUsage
	$effect.pre(() => {
		if (positionAttribute) {
			positionAttribute.setUsage(DynamicDrawUsage)
		}
		if (colorAttribute) {
			colorAttribute.setUsage(DynamicDrawUsage)
		}
	})

	$effect.pre(() => {
		material.size = pointSize
	})

	$effect.pre(() => {
		material.color.set(colors ? 0xffffff : (object.metadata.color ?? settings.current.pointColor))
	})

	$effect.pre(() => {
		if (!positionAttribute || positionAttribute.array.length !== positions.length) {
			positionAttribute = new BufferAttribute(positions, 3)
			positionAttribute.setUsage(DynamicDrawUsage)
			geometry.setAttribute('position', positionAttribute)
		} else {
			if (!isEqual(positionAttribute.array, positions)) {
				positionAttribute.array.set(positions)
			}
			positionAttribute.needsUpdate = true
			geometry.computeBoundingSphere()
		}
	})

	$effect.pre(() => {
		if (updateVersion > 0) {
			if (positionAttribute) {
				positionAttribute.needsUpdate = true
				geometry.computeBoundingSphere()
			}
		}
	})

	$effect.pre(() => {
		material.vertexColors = colors !== undefined

		if (colors) {
			if (!colorAttribute || colorAttribute.array.length !== colors.length) {
				colorAttribute = new BufferAttribute(colors, 3)
				colorAttribute.setUsage(DynamicDrawUsage)
				geometry.setAttribute('color', colorAttribute)
			} else {
				if (!isEqual(colorAttribute.array, colors)) {
					colorAttribute.array.set(colors)
				}
				colorAttribute.needsUpdate = true
			}
		} else if (colorAttribute) {
			geometry.deleteAttribute('color')
			colorAttribute = null
		}
	})

	$effect.pre(() => {
		poseToObject3d(object.pose, points)
	})

	const events = useObjectEvents(() => object.uuid)

	const { start, stop } = useTask(
		() => {
			// If using an orthographic camera, points need to be
			// resized to half zoom to take up the same screen space.
			material.size = pointSize * ((camera.current as OrthographicCamera).zoom / 2)
		},
		{ autoStart: false }
	)

	$effect(() => {
		if (orthographic) {
			start()
		} else {
			stop()
			material.size = pointSize
		}
	})
</script>

<T
	is={points}
	name={object.name}
	uuid={object.uuid}
	{...events}
	bvh={{ maxDepth: 40, maxLeafTris: 20 }}
>
	<T is={geometry} />
	<T is={material} />
	{@render children?.()}
</T>
