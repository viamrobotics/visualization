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
	import { RGBA_FIELDS, normalizeColorValue } from '$lib/color'
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

	const effectiveLineWidth = $derived(
		geometry.geometryType.value.lineWidth
			? geometry.geometryType.value.lineWidth * 0.001
			: settings.current.lineWidth
	)
	const effectivePointSize = $derived(
		geometry.geometryType.value.pointSize
			? geometry.geometryType.value.pointSize * 0.001
			: settings.current.lineDotSize
	)

	let positions = $state<Vector3[]>([])

	$effect(() => {
		const { points } = parsePoints(geometry.geometryType.value.positions)
		let colorData = metadata?.colors ?? new Uint8Array([0, 128, 255, 255, 0, 77, 204, 255])
		let hasPointColor = false
		if (colorData.length === RGBA_FIELDS.length * 2) {
			hasPointColor = true
		}

		lineColor.setRGB(
			normalizeColorValue(colorData[0]),
			normalizeColorValue(colorData[1]),
			normalizeColorValue(colorData[2])
		)

		lineOpacity = normalizeColorValue(colorData[3] ?? 255)

		if (hasPointColor) {
			pointColor.setRGB(
				normalizeColorValue(colorData[4]),
				normalizeColorValue(colorData[5]),
				normalizeColorValue(colorData[6])
			)
			pointOpacity = normalizeColorValue(colorData[7] ?? 255)
		} else {
			pointColor.copy(lineColor)
			pointOpacity = lineOpacity
		}

		positions = points
	})
</script>

{#if positions.length > 0}
	<T.Mesh
		raycast={() => null}
		bvh={{ enabled: false }}
	>
		<MeshLineGeometry points={positions} />
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

		{#each positions as point, i (i)}
			<Instance position={[point.x, point.y, point.z]} />
		{/each}
	</InstancedMesh>
{/if}
