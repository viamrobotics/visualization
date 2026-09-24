<script lang="ts">
	import type { Entity } from 'koota'
	import type { Snippet } from 'svelte'

	import { T, useThrelte } from '@threlte/core'
	import { meshBounds } from '@threlte/extras'
	import { Line2, LineMaterial } from 'three/examples/jsm/Addons.js'

	import { isVertexColors, STRIDE } from '$lib/buffer'
	import { traits, useOpacity, useTrait } from '$lib/ecs'

	import { useEntityEvents } from './hooks/useEntityEvents.svelte'
	import LineDots from './LineDots.svelte'
	import LineGeometry from './LineGeometry.svelte'

	interface Props {
		entity: Entity
		children?: Snippet
	}

	let { entity, children }: Props = $props()

	const { invalidate } = useThrelte()
	const name = useTrait(() => entity, traits.Name)
	const worldMatrix = useTrait(() => entity, traits.WorldMatrix)
	const color = useTrait(() => entity, traits.Color)
	const colors = useTrait(() => entity, traits.Colors)
	const dotColors = useTrait(() => entity, traits.DotColors)
	const dotSize = useTrait(() => entity, traits.DotSize)
	const linePositions = useTrait(() => entity, traits.LinePositions)
	const lineWidth = useTrait(() => entity, traits.LineWidth)
	const materialProps = useTrait(() => entity, traits.Material)
	const renderOrder = useTrait(() => entity, traits.RenderOrder)
	const opacity = useOpacity(() => entity)
	const screenSpace = useTrait(() => entity, traits.ScreenSpace)
	const invisible = useTrait(() => entity, traits.InheritedInvisible)

	const events = useEntityEvents(() => entity)

	const hasVertexColors = $derived(isVertexColors(colors.current))

	const lineColor = $derived.by<[number, number, number]>(() => {
		if (color.current) return [color.current.r, color.current.g, color.current.b]
		return [0, 0, 1]
	})

	const lineColors = $derived.by<Float32Array | undefined>(() => {
		if (!colors.current) return undefined
		const numColors = colors.current.length / STRIDE.COLORS_RGB
		const rgb = new Float32Array(numColors * 3)
		for (let i = 0; i < numColors; i++) {
			rgb[i * 3] = colors.current[i * STRIDE.COLORS_RGB]! / 255
			rgb[i * 3 + 1] = colors.current[i * STRIDE.COLORS_RGB + 1]! / 255
			rgb[i * 3 + 2] = colors.current[i * STRIDE.COLORS_RGB + 2]! / 255
		}
		return rgb
	})

	const currentOpacity = $derived(opacity.current)

	const mesh = new Line2()
	mesh.matrixAutoUpdate = false

	$effect.pre(() => {
		if (worldMatrix.current) {
			mesh.matrix.copy(worldMatrix.current)
			mesh.updateMatrixWorld()
			invalidate()
		}
	})
</script>

<T
	is={mesh}
	name={entity}
	userData.name={name}
	raycast={meshBounds}
	renderOrder={renderOrder.current ?? 0}
	visible={invisible.current !== true}
	{...events}
>
	<LineGeometry
		positions={linePositions.current}
		colors={lineColors}
	/>
	<T
		is={LineMaterial}
		color={hasVertexColors ? [1, 1, 1] : lineColor}
		vertexColors={hasVertexColors}
		transparent={currentOpacity < 1}
		depthWrite={currentOpacity === 1}
		opacity={currentOpacity}
		worldUnits={!screenSpace.current}
		linewidth={(lineWidth.current ?? 5) * (screenSpace.current ? 1 : 0.001)}
		depthTest={materialProps.current?.depthTest ?? true}
	/>

	{#if linePositions.current && dotSize.current}
		<LineDots
			colors={dotColors.current ?? new Uint8Array()}
			opacity={currentOpacity}
			positions={linePositions.current}
			scale={dotSize.current * 0.001}
		/>
	{/if}

	{@render children?.()}
</T>
