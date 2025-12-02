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
		let colorData = metadata?.colors ?? new Float32Array([0, 0.5, 1, 1, 0, 0.3, 0.8, 1]) // Default line blue + point darker blue
		let hasPointColor = false
		if (colorData.length === RGBA_FIELDS.length * 2) {
			hasPointColor = true
		}

		lineColor.setRGB(colorData[0], colorData[1], colorData[2])
		lineOpacity = colorData[3] ?? 1.0

		if (hasPointColor) {
			pointColor.setRGB(colorData[4], colorData[5], colorData[6])
			pointOpacity = colorData[7] ?? 1.0
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
