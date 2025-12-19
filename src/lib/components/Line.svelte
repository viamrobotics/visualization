<script lang="ts">
	import { T } from '@threlte/core'
	import { Instance, InstancedMesh, MeshLineGeometry, MeshLineMaterial } from '@threlte/extras'
	import { Color, Vector3 } from 'three'
	import { Portal, PortalTarget } from '@threlte/extras'
	import { useSettings } from '$lib/hooks/useSettings.svelte'
	import type { Snippet } from 'svelte'
	import type { Entity } from 'koota'
	import { traits, useTrait } from '$lib/ecs'
	import { asFloat32Array } from '$lib/buffer'

	interface Props {
		entity: Entity
		children?: Snippet
	}

	let { entity, children }: Props = $props()

	const name = useTrait(() => entity, traits.Name)
	const parent = useTrait(() => entity, traits.Parent)
	const settings = useSettings()
	const positions = useTrait(() => entity, traits.Positions)
	const lineWidth = useTrait(() => entity, traits.LineWidth)
	const pointSize = useTrait(() => entity, traits.PointSize)
	const colors = useTrait(() => entity, traits.ColorsRGBA)
	const points = $derived.by(() => {
		const positionsData = positions.current
		if (!positionsData || positionsData.length === 0) return []

		const floats = asFloat32Array(positionsData)
		const result: Vector3[] = []
		for (let i = 0; i < floats.length; i += 3) {
			result.push(
				new Vector3(
					floats[i] * 0.001, // mm to m
					floats[i + 1] * 0.001,
					floats[i + 2] * 0.001
				)
			)
		}

		return result
	})

	const lineColor = $derived.by(() => {
		const colorsData = colors.current
		if (colorsData && colorsData.length >= 4) {
			return new Color(colorsData[0] / 255, colorsData[1] / 255, colorsData[2] / 255)
		}
		return new Color(0, 0, 1) // blue
	})

	const pointColor = $derived.by(() => {
		const colorsData = colors.current
		if (colorsData && colorsData.length >= 8) {
			return new Color(colorsData[4] / 255, colorsData[5] / 255, colorsData[6] / 255)
		}
		if (colorsData && colorsData.length >= 4) {
			return new Color(colorsData[0] / 255, colorsData[1] / 255, colorsData[2] / 255)
		}
		return settings.current.pointColor
	})

	const width = $derived(
		lineWidth.current ? lineWidth.current * 0.001 : settings.current.lineWidth * 0.001
	)

	const dotSize = $derived(
		pointSize.current ? pointSize.current * 0.001 : settings.current.lineDotSize * 0.001
	)
</script>

<Portal id={parent.current}>
	{#if points.length > 0}
		<T.Mesh
			frustumCulled={false}
			bvh={{ enabled: false }}
			raycast={() => null}
		>
			<MeshLineGeometry {points} />
			<MeshLineMaterial
				color={lineColor}
				{width}
			/>
		</T.Mesh>

		<InstancedMesh
			frustumCulled={false}
			bvh={{ enabled: false }}
			raycast={() => null}
		>
			<T.SphereGeometry />
			<T.MeshBasicMaterial color={pointColor} />

			{#each points as point, i (i)}
				<Instance
					position.x={point.x}
					position.y={point.y}
					position.z={point.z}
					scale={dotSize}
				/>
			{/each}
		</InstancedMesh>
	{/if}

	{@render children?.()}
	<PortalTarget id={name.current} />
</Portal>
