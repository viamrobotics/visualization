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

	// Material setup - do this once
	material.toneMapped = false
	material.transparent = true
	material.depthWrite = false

	// Use point size directly (already in meters from data provider)
	const effectivePointSize = $derived(
		geometry.geometryType.value.pointSize
			? geometry.geometryType.value.pointSize
			: settings.current.pointSize
	)

	const orthographic = $derived(settings.current.cameraMode === 'orthographic')

	$effect.pre(() => {
		material.size = effectivePointSize
	})

	$effect(() => {
		// Parse positions
		const { pointsData } = parsePoints(geometry.geometryType.value.positions)
		const pointCount = pointsData.length / 3
		console.log('PointsShape - parsed:', {
			pointCount,
			hasMetadata: !!metadata,
			metadataColors: metadata?.colors,
			pointSize: effectivePointSize,
		})
		buffer.setAttribute('position', new BufferAttribute(pointsData, 3))
		buffer.computeBoundingSphere()

		// Handle colors (RGBA format)
		const colors = metadata?.colors
		if (colors && colors.length > 0) {
			// Determine if we have per-point colors or a single color
			const rgbaPerColor = 4
			const numColors = colors.length / rgbaPerColor

			if (numColors > 1 && numColors === pointCount) {
				// Per-point colors: extract RGB for color attribute
				const rgbColors = new Float32Array(pointCount * 3)
				for (let i = 0; i < pointCount; i++) {
					const srcIdx = i * 4
					const dstIdx = i * 3
					rgbColors[dstIdx] = colors[srcIdx] // R
					rgbColors[dstIdx + 1] = colors[srcIdx + 1] // G
					rgbColors[dstIdx + 2] = colors[srcIdx + 2] // B
				}
				material.vertexColors = true
				buffer.setAttribute('color', new BufferAttribute(rgbColors, 3))

				// Use first alpha for material opacity (per-vertex alpha not supported in WebGL)
				material.opacity = colors[3] ?? 1.0
			} else if (numColors === 1) {
				// Single color for all points
				material.vertexColors = false
				material.color.setRGB(colors[0], colors[1], colors[2])
				material.opacity = colors[3] ?? 1.0
			}
		} else {
			// Use default point color from settings
			material.vertexColors = false
			const pointColor = settings.current.pointColor
			if (Array.isArray(pointColor) && pointColor.length >= 3) {
				material.color.setRGB(pointColor[0], pointColor[1], pointColor[2])
				material.opacity = pointColor[3] ?? 1.0
			}
		}

		// Mark material as needing update
		material.size = effectivePointSize
		material.needsUpdate = true
	})

	const { start, stop } = useTask(
		() => {
			// If using an orthographic camera, points need to be
			// resized to half zoom to take up the same screen space.
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
