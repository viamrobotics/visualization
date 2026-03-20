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

	import { darkenColor } from '$lib/color'
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
	const pointSize = useTrait(() => entity, traits.PointSize)
	const linePositions = useTrait(() => entity, traits.LinePositions)
	const lineWidth = useTrait(() => entity, traits.LineWidth)
	const opacity = useTrait(() => entity, traits.Opacity)
	const materialProps = useTrait(() => entity, traits.Material)
	const renderOrder = useTrait(() => entity, traits.RenderOrder)

	const events = useEntityEvents(() => entity)

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
		{...events}
	>
		<LineGeometry positions={linePositions.current} />
		<T
			is={LineMaterial}
			color={[color.current?.r ?? 1, color.current?.g ?? 0, color.current?.b ?? 0]}
			transparent={currentOpacity < 1}
			depthWrite={currentOpacity === 1}
			opacity={currentOpacity}
			width={lineWidth.current ? lineWidth.current * 0.001 : 0.5}
			depthTest={materialProps.current?.depthTest ?? true}
		/>
	</T>

	{#if linePositions.current && pointSize.current}
		<LineDots
			color={darkenColor(
				colorUtil.setRGB(color.current?.r ?? 1, color.current?.g ?? 0, color.current?.b ?? 0),
				10
			)}
			positions={linePositions.current}
			scale={pointSize.current * 0.001}
		/>
	{/if}

	{#if name.current}
		<PortalTarget id={name.current} />
	{/if}

	{@render children?.()}
</Portal>
