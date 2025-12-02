<!--

This component is consumed as a library export
and should remain pure, i.e. no hooks should be used.

-->
<script lang="ts">
	import { T } from '@threlte/core'
	import { Instance, InstancedMesh, MeshLineGeometry, MeshLineMaterial } from '@threlte/extras'
	import { Color, Vector3 } from 'three'
	import type { WorldObject } from '$lib/WorldObject.svelte'
	import { parsePoints } from '$lib/point'
	import { useSettings } from '$lib/hooks/useSettings.svelte'
	import { RGBA_FIELDS } from '$lib/color'
	import type { LineGeometry } from '$lib/shape'

	interface Props {
		geometry: LineGeometry
		metadata: WorldObject['metadata']
	}

	let { geometry, metadata }: Props = $props()

	const settings = useSettings()

	const lineColor = new Color()
	const pointColor = new Color()
	let lineOpacity = $state(1.0)
	let pointOpacity = $state(1.0)

	// Extract line width and dot size from proto or use defaults
	// NOTE: For snapshot drawings, these values are already in meters (converted by Go code)
	// So we use them directly without the mm->m conversion
	const effectiveLineWidth = $derived(
		geometry.geometryType.value.lineWidth ?? settings.current.lineWidth
	)
	const effectivePointSize = $derived(
		geometry.geometryType.value.pointSize ?? settings.current.lineDotSize
	)

	let points = $state<Vector3[]>([])

	$effect(() => {
		// Parse the line points data
		const { points: parsedPoints } = parsePoints(geometry.geometryType.value.points)

		// metadata.colors should already be a Float32Array parsed in WorldObject constructor (RGBA format)
		let colorData = metadata?.colors ?? new Float32Array([0, 0.5, 1, 1, 0, 0.3, 0.8, 1]) // Default line blue + point darker blue

		// Check if we have dual colors (line + dots) - now RGBA format
		let hasPointColor = false
		if (colorData.length === RGBA_FIELDS.length * 2) {
			hasPointColor = true
		}

		// Extract colors (RGBA format) - support single color or dual colors (line + dot)
		lineColor.setRGB(colorData[0], colorData[1], colorData[2])
		lineOpacity = colorData[3] ?? 1.0

		if (hasPointColor) {
			// Dual colors: line RGBA at [0-3], dot RGBA at [4-7]
			pointColor.setRGB(colorData[4], colorData[5], colorData[6])
			pointOpacity = colorData[7] ?? 1.0
		} else {
			pointColor.copy(lineColor)
			pointOpacity = lineOpacity
		}

		// parsePoints already returns Vector3 array
		points = parsedPoints
	})
</script>

{#if points.length > 0}
	<T.Mesh
		raycast={() => null}
		bvh={{ enabled: false }}
	>
		<MeshLineGeometry {points} />
		<MeshLineMaterial
			color={lineColor}
			width={effectiveLineWidth}
			transparent={lineOpacity < 1.0}
			opacity={lineOpacity}
			smoothing={true}
		/>
	</T.Mesh>

	<InstancedMesh
		frustumCulled={false}
		bvh={{ enabled: false }}
	>
		<T.SphereGeometry args={[effectivePointSize, 8, 8]} />
		<T.MeshBasicMaterial
			color={pointColor}
			transparent={pointOpacity < 1.0}
			opacity={pointOpacity}
		/>

		{#each points as point, i (i)}
			<Instance position={[point.x, point.y, point.z]} />
		{/each}
	</InstancedMesh>
{/if}
