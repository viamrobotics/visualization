<script lang="ts">
	import { T, type Props as ThrelteProps } from '@threlte/core'
	import { type Snippet } from 'svelte'
	import { Group } from 'three'
	import { poseToObject3d } from '$lib/transform'
	import type { WorldObject } from '$lib/WorldObject.svelte'
	import ArrowsShape from './ArrowsShape.svelte'
	import LineShape from './LineShape.svelte'
	import ModelShape from './ModelShape.svelte'
	import PointsShape from './PointsShape.svelte'
	import AxesHelper from '../AxesHelper.svelte'
	import { isArrows, isLine, isPoints, isModel, type Shape } from '$lib/shape'
	import { RenderShapes } from '$lib/gen/draw/v1/scene_pb'

	interface Props extends ThrelteProps<Group> {
		uuid: string
		name: string
		geometry?: Shape
		pose: WorldObject['pose']
		metadata: WorldObject['metadata']
		renderShapes?: RenderShapes[]
		units?: 'mm' | 'm'
		children?: Snippet<[{ ref: Group }]>
	}

	let {
		geometry,
		pose,
		metadata,
		renderShapes = [
			RenderShapes.ARROWS,
			RenderShapes.POINTS,
			RenderShapes.LINES,
			RenderShapes.MODEL,
			RenderShapes.NURBS,
		],
		children,
		units = 'mm',
		...rest
	}: Props = $props()

	const group = new Group()

	$effect.pre(() => {
		poseToObject3d(pose, group, units)
	})
</script>

<T
	is={group}
	{...rest}
>
	<AxesHelper
		width={3}
		length={0.1}
	/>

	{#if isArrows(geometry) && renderShapes.includes(RenderShapes.ARROWS)}
		<ArrowsShape
			{geometry}
			{metadata}
		/>
	{:else if isLine(geometry) && renderShapes.includes(RenderShapes.LINES)}
		<LineShape
			{geometry}
			{metadata}
		/>
	{:else if isPoints(geometry) && renderShapes.includes(RenderShapes.POINTS)}
		<PointsShape
			{geometry}
			{metadata}
		/>
	{:else if isModel(geometry) && renderShapes.includes(RenderShapes.MODEL)}
		<ModelShape
			{geometry}
			{metadata}
		/>
	{/if}

	{@render children?.({ ref: group })}
</T>
