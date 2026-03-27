<script module>
	import { Color } from 'three'

	const colorUtil = new Color()
</script>

<script lang="ts">
	import type { Entity } from 'koota'
	import type { Snippet } from 'svelte'

	import { T, useThrelte } from '@threlte/core'
	import { meshBounds, Portal, PortalTarget } from '@threlte/extras'
	import { Line2, LineMaterial } from 'three/examples/jsm/Addons.js'

	import { asColor, asOpacity, isRgba } from '$lib/buffer'
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
	const colors = useTrait(() => entity, traits.Colors)
	const dotColors = useTrait(() => entity, traits.DotColors)
	const dotSize = useTrait(() => entity, traits.DotSize)
	const linePositions = useTrait(() => entity, traits.LinePositions)
	const lineWidth = useTrait(() => entity, traits.LineWidth)
	const materialProps = useTrait(() => entity, traits.Material)
	const renderOrder = useTrait(() => entity, traits.RenderOrder)
	const screenSpace = useTrait(() => entity, traits.ScreenSpace)

	const events = useEntityEvents(() => entity)

	const lineColor = $derived.by<[number, number, number]>(() => {
		if (!colors.current) return [0, 0, 1]
		asColor(colors.current, colorUtil, 0)
		return [colorUtil.r, colorUtil.g, colorUtil.b]
	})

	const currentOpacity = $derived.by(() => {
		if (!colors.current) return 0.7
		if (!isRgba(colors.current)) return 0.7
		return asOpacity(colors.current)
	})

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
		{...events}
	>
		<LineGeometry positions={linePositions.current} />
		<T
			is={LineMaterial}
			color={lineColor}
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
			positions={linePositions.current}
			scale={dotSize.current * 0.001}
		/>
	{/if}

	{#if name.current}
		<PortalTarget id={name.current} />
	{/if}

	{@render children?.()}
</Portal>
