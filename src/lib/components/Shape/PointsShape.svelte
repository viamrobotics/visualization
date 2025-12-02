<!--

This component is consumed as a library export
and should remain pure, i.e. no hooks should be used.

-->
<script lang="ts">
	import { T, useTask, useThrelte } from '@threlte/core'
	import {
		Points,
		BufferGeometry,
		BufferAttribute,
		PointsMaterial,
		OrthographicCamera,
	} from 'three'
	import type { PointsGeometry } from '$lib/shape'
	import type { WorldObject } from '$lib/WorldObject.svelte'
	import { parsePoints } from '$lib/point'
	import { useSettings } from '$lib/hooks/useSettings.svelte'
	import type { Snippet } from 'svelte'

	interface Props {
		geometry: PointsGeometry
		metadata: WorldObject['metadata']
		children?: Snippet
	}

	const { geometry, metadata, children }: Props = $props()

	const { camera } = useThrelte()
	const settings = useSettings()

	const buffer = new BufferGeometry()
	const material = new PointsMaterial()
	const points = new Points(buffer, material)

	material.toneMapped = false
	material.transparent = true
	material.depthWrite = false

	const effectivePointSize = $derived(
		geometry.geometryType.value.pointSize
			? geometry.geometryType.value.pointSize * 0.001
			: settings.current.pointSize
	)

	const orthographic = $derived(settings.current.cameraMode === 'orthographic')

	$effect.pre(() => {
		material.size = effectivePointSize
	})

	$effect(() => {
		const { pointsData } = parsePoints(geometry.geometryType.value.positions)
		const pointCount = pointsData.length / 3
		buffer.setAttribute('position', new BufferAttribute(pointsData, 3))
		buffer.computeBoundingSphere()

		const colors = metadata?.colors
		if (colors && colors.length > 0) {
			const rgbaPerColor = 4
			const numColors = colors.length / rgbaPerColor

			if (numColors > 1 && numColors === pointCount) {
				const rgbColors = new Float32Array(pointCount * 3)
				for (let i = 0; i < pointCount; i++) {
					const srcIdx = i * 4
					const dstIdx = i * 3
					rgbColors[dstIdx] = colors[srcIdx]
					rgbColors[dstIdx + 1] = colors[srcIdx + 1]
					rgbColors[dstIdx + 2] = colors[srcIdx + 2]
				}

				material.vertexColors = true
				material.opacity = colors[3] ?? 1.0
				buffer.setAttribute('color', new BufferAttribute(rgbColors, 3))
			} else if (numColors === 1) {
				material.vertexColors = false
				material.opacity = colors[3] ?? 1.0
				material.color.setRGB(colors[0], colors[1], colors[2])
			}
		} else {
			material.vertexColors = false
			const pointColor = settings.current.pointColor
			if (Array.isArray(pointColor) && pointColor.length >= 3) {
				material.color.setRGB(pointColor[0], pointColor[1], pointColor[2])
				material.opacity = pointColor[3] ?? 1.0
			}
		}

		material.size = effectivePointSize
		material.needsUpdate = true
	})

	const { start, stop } = useTask(
		() => {
			material.size = effectivePointSize * ((camera.current as OrthographicCamera).zoom / 2)
		},
		{
			autoStart: false,
			autoInvalidate: false,
		}
	)

	$effect(() => {
		if (orthographic) {
			start()
		} else {
			stop()
			material.size = effectivePointSize
		}
	})
</script>

<T
	is={points}
	bvh={{ enabled: false }}
>
	{@render children?.()}
</T>
