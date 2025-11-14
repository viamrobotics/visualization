<script
	module
	lang="ts"
>
	const colorUtil = new Color()
</script>

<!--

This component is consumed as a library export
and should remain pure, i.e. no hooks should be used.

-->
<script lang="ts">
	import { T, useThrelte, type Props as ThrelteProps } from '@threlte/core'
	import { type Snippet } from 'svelte'
	import { meshBounds, MeshLineGeometry, MeshLineMaterial, Wireframe } from '@threlte/extras'
	import { BufferGeometry, Color, DoubleSide, FrontSide, Group, Mesh } from 'three'
	import { CapsuleGeometry } from '$lib/three/CapsuleGeometry'
	import { colors, darkenColor } from '$lib/color'
	import AxesHelper from './AxesHelper.svelte'
	import type { Entity } from 'koota'
	import { traits, useTrait } from '$lib/ecs'
	import { poseToObject3d } from '$lib/transform'

	interface Props extends ThrelteProps<Group> {
		entity: Entity
		color?: string
		model?: Group
		renderMode?: 'model' | 'colliders' | 'colliders+model'
		children?: Snippet<[{ ref: Group }]>
	}

	let {
		entity,
		color: overrideColor,
		model,
		renderMode = 'colliders',
		children,
		...rest
	}: Props = $props()

	const { invalidate } = useThrelte()
	const name = useTrait(() => entity, traits.Name)
	const uuid = useTrait(() => entity, traits.UUID)

	const geometryType = $derived.by(() => {
		if (entity.has(traits.Box)) return 'box'
		if (entity.has(traits.Capsule)) return 'capsule'
		if (entity.has(traits.Sphere)) return 'sphere'
		if (entity.has(traits.BufferGeometry)) return 'buffer'
		if (entity.has(traits.LineGeometry)) return 'line'
		if (entity.has(traits.PointsGeometry)) return 'points'
	})
	const entityColor = $derived.by(() => {
		const result = entity.get(traits.Color)

		if (result) {
			return colorUtil.setRGB(result.r, result.g, result.b).getHexString()
		}
	})
	const color = $derived(overrideColor ?? entityColor ?? colors.default)

	const group = new Group()
	const mesh = $derived.by(() => {
		if (geometryType === undefined) {
			return
		}

		const result = new Mesh()

		if (geometryType === 'buffer' || geometryType === 'points' || geometryType === 'line') {
			result.raycast = meshBounds
		}

		return result
	})

	const center = useTrait(() => entity, traits.Center)
	$effect.pre(() => {
		if (mesh && center.current) {
			poseToObject3d(center.current, mesh)
			invalidate()
		}
	})

	const pose = useTrait(() => entity, traits.Pose)
	$effect.pre(() => {
		if (pose.current) {
			poseToObject3d(pose.current, group)
			invalidate()
		}
	})

	let geo = $state.raw<BufferGeometry>()

	const oncreate = (ref: BufferGeometry) => {
		geo = ref
	}

	$inspect(geometryType)
</script>

<T
	is={group}
	{...rest}
>
	{#if geometryType}
		<AxesHelper
			width={3}
			length={0.1}
		/>

		<T
			is={mesh}
			{name}
			{uuid}
			bvh={{ enabled: false }}
		>
			{#if model && renderMode.includes('model')}
				<T is={model} />
			{/if}

			{#if renderMode.includes('colliders')}
				{#if geometryType === 'buffer'}
					{@const geometry = useTrait(() => entity, traits.BufferGeometry)}

					{#if geometry.current}
						<T
							is={geometry.current}
							{oncreate}
						/>
					{/if}
				{:else if geometryType === 'line'}
					<!-- <MeshLineGeometry points={metadata.points} /> -->
				{:else if geometryType === 'box'}
					{@const box = useTrait(() => entity, traits.Box)}
					<T.BoxGeometry
						args={[box.current?.x, box.current?.y, box.current?.z]}
						{oncreate}
					/>
				{:else if geometryType === 'sphere'}
					{@const sphere = useTrait(() => entity, traits.Sphere)}
					<T.SphereGeometry
						args={[sphere.current?.r]}
						{oncreate}
					/>
				{:else if geometryType === 'capsule'}
					{@const capsule = useTrait(() => entity, traits.Capsule)}
					<T
						is={CapsuleGeometry}
						args={[capsule.current?.r, capsule.current?.l]}
						{oncreate}
					/>
				{/if}
			{/if}

			{#if geometryType === 'line'}
				<MeshLineMaterial
					{color}
					width={/* metadata.lineWidth ?? */ 0.005}
				/>
			{:else}
				<T.MeshToonMaterial
					{color}
					side={geometryType === 'buffer' ? DoubleSide : FrontSide}
					transparent
					opacity={useTrait(() => entity, traits.Opacity).current ?? 0.7}
				/>

				{#if geo && renderMode.includes('colliders')}
					<!-- <Wireframe
						thickness={0.01}
						strokeOpacity={1}
						stroke={darkenColor(color, 10)}
					/> -->
					<T.LineSegments
						raycast={() => null}
						bvh={{ enabled: false }}
					>
						<T.EdgesGeometry args={[geo, 0]} />
						<T.LineBasicMaterial color={darkenColor(color, 10)} />
					</T.LineSegments>
				{/if}
			{/if}
		</T>
	{:else}
		<AxesHelper
			{name}
			{uuid}
			width={3}
			length={0.1}
		/>
	{/if}

	{@render children?.({ ref: group })}
</T>
