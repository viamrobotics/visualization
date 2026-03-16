<script lang="ts">
	import type { Pose } from '@viamrobotics/sdk'
	import type { Entity } from 'koota'

	import { T, type Props as ThrelteProps, useThrelte } from '@threlte/core'
	import { type Snippet } from 'svelte'
	import { BufferGeometry, Color, DoubleSide, FrontSide, Mesh } from 'three'

	import { colors, darkenColor } from '$lib/color'
	import { traits, useTrait } from '$lib/ecs'
	import { CapsuleGeometry } from '$lib/three/CapsuleGeometry'
	import { poseToObject3d } from '$lib/transform'

	import AxesHelper from '../AxesHelper.svelte'

	interface Props extends ThrelteProps<Mesh> {
		entity: Entity
		color?: string
		center?: Pose
		children?: Snippet
	}

	let { entity, color: overrideColor, center, children, ...rest }: Props = $props()

	const colorUtil = new Color()

	const { invalidate } = useThrelte()
	const name = useTrait(() => entity, traits.Name)
	const entityColor = useTrait(() => entity, traits.Color)
	const opacity = useTrait(() => entity, traits.Opacity)
	const box = useTrait(() => entity, traits.Box)
	const capsule = useTrait(() => entity, traits.Capsule)
	const sphere = useTrait(() => entity, traits.Sphere)
	const bufferGeometry = useTrait(() => entity, traits.BufferGeometry)
	const showAxesHelper = useTrait(() => entity, traits.ShowAxesHelper)
	const materialProps = useTrait(() => entity, traits.Material)
	const renderOrder = useTrait(() => entity, traits.RenderOrder)

	const color = $derived.by(() => {
		if (overrideColor) {
			return overrideColor
		}

		if (entityColor.current) {
			return colorUtil.setRGB(entityColor.current.r, entityColor.current.g, entityColor.current.b)
		}

		return colors.default
	})

	const mesh = new Mesh()

	$effect.pre(() => {
		if (center) {
			poseToObject3d(center, mesh)
			invalidate()
		}
	})

	let geo = $state.raw<BufferGeometry>()

	const oncreate = (bufferGeometry: BufferGeometry) => {
		geo = bufferGeometry
	}
</script>

<T
	is={mesh}
	name={entity}
	userData.name={name}
	renderOrder={renderOrder.current}
	{...rest}
>
	{#if box.current}
		{@const { x, y, z } = box.current ?? { x: 0, y: 0, z: 0 }}
		<T.BoxGeometry
			args={[x * 0.001, y * 0.001, z * 0.001]}
			{oncreate}
		/>
	{:else if sphere.current}
		{@const { r } = sphere.current ?? { r: 0 }}
		<T.SphereGeometry
			args={[r * 0.001]}
			{oncreate}
		/>
	{:else if capsule.current}
		{@const { r, l } = capsule.current ?? { r: 0, l: 0 }}
		<T
			is={CapsuleGeometry}
			args={[r * 0.001, l * 0.001]}
			{oncreate}
		/>
	{:else if bufferGeometry.current}
		<T
			is={bufferGeometry.current}
			{oncreate}
		/>
	{/if}

	{@const currentOpacity = opacity.current ?? 0.7}
	<T.MeshToonMaterial
		{color}
		side={bufferGeometry.current ? DoubleSide : FrontSide}
		transparent={currentOpacity < 1}
		depthWrite={currentOpacity === 1}
		opacity={currentOpacity}
		depthTest={materialProps.current?.depthTest ?? true}
	/>

	<!-- 
		TODO(mp) currently some bufferGeometries are coming in empty, 
		this is a quick fix but this should be handled upstream
	-->
	{#if geo && geo.getAttribute('position').array.length > 0}
		<T.LineSegments
			raycast={() => null}
			bvh={{ enabled: false }}
		>
			<T.EdgesGeometry args={[geo, 0]} />
			<T.LineBasicMaterial color={darkenColor(color, 10)} />
		</T.LineSegments>
	{/if}

	{@render children?.()}
</T>

{#if showAxesHelper.current}
	<AxesHelper
		name={entity}
		width={3}
		length={0.1}
	/>
{/if}
