<script lang="ts">
	import type { Entity } from 'koota'
	import type { Snippet } from 'svelte'

	import { T, useThrelte } from '@threlte/core'
	import { meshBounds, Portal, PortalTarget } from '@threlte/extras'
	import { Line2, LineMaterial } from 'three/examples/jsm/Addons.js'

	import { isVertexColors, STRIDE } from '$lib/buffer'
	import { traits, useTrait } from '$lib/ecs'
	import { poseToObject3d } from '$lib/transform'

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
	const parent = useTrait(() => entity, traits.Parent)
	const pose = useTrait(() => entity, traits.Pose)
	const color = useTrait(() => entity, traits.Color)
	const colors = useTrait(() => entity, traits.Colors)
	const dotColors = useTrait(() => entity, traits.DotColors)
	const dotSize = useTrait(() => entity, traits.DotSize)
	const linePositions = useTrait(() => entity, traits.LinePositions)
	const lineWidth = useTrait(() => entity, traits.LineWidth)
	const materialProps = useTrait(() => entity, traits.Material)
	const renderOrder = useTrait(() => entity, traits.RenderOrder)
	const opacity = useTrait(() => entity, traits.Opacity)
	const screenSpace = useTrait(() => entity, traits.ScreenSpace)
	const invisible = useTrait(() => entity, traits.Invisible)

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

	const currentOpacity = $derived(opacity.current ?? 0.7)

	const mesh = new Line2()

	$effect.pre(() => {
		if (pose.current) {
			poseToObject3d(pose.current, mesh)
			invalidate()
		}
	})
</script>

<Portal id={parent.current}>
	<T
		is={mesh}
		name={entity}
		userData.name={name}
		raycast={meshBounds}
		renderOrder={renderOrder.current}
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
	</T>

	{#if linePositions.current && dotSize.current}
		<LineDots
			colors={dotColors.current ?? new Uint8Array()}
			opacity={currentOpacity}
			positions={linePositions.current}
			scale={dotSize.current * 0.001}
		/>
	{/if}

	{#if name.current}
		<PortalTarget id={name.current} />
	{/if}

	{@render children?.()}
</Portal>
