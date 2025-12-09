<script
	module
	lang="ts"
>
</script>

<!--

This component is consumed as a library export
and should remain pure, i.e. no hooks should be used.

-->
<script lang="ts">
	import { T, useThrelte, type Props as ThrelteProps } from '@threlte/core'
	import { type Snippet } from 'svelte'
	import { meshBounds, MeshLineMaterial, MeshLineGeometry } from '@threlte/extras'
	import { BufferGeometry, Color, DoubleSide, FrontSide, Group, Mesh } from 'three'
	import { CapsuleGeometry } from '$lib/three/CapsuleGeometry'
	import { colors, darkenColor } from '$lib/color'
	import AxesHelper from './AxesHelper.svelte'
	import type { Entity } from 'koota'
	import { traits, useTrait } from '$lib/ecs'
	import { poseToObject3d } from '$lib/transform'
	import type { Pose } from '@viamrobotics/sdk'

	interface Props extends ThrelteProps<Group> {
		entity: Entity
		color?: string
		model?: Group
		pose?: Pose
		renderMode?: 'model' | 'colliders' | 'colliders+model'
		children?: Snippet<[{ ref: Group }]>
	}

	let {
		entity,
		color: overrideColor,
		model,
		renderMode = 'colliders',
		pose,
		children,
		...rest
	}: Props = $props()

	const colorUtil = new Color()

	const { invalidate } = useThrelte()
	const name = useTrait(() => entity, traits.Name)
	const entityColor = useTrait(() => entity, traits.Color)
	const box = useTrait(() => entity, traits.Box)
	const capsule = useTrait(() => entity, traits.Capsule)
	const sphere = useTrait(() => entity, traits.Sphere)
	const bufferGeometry = useTrait(() => entity, traits.BufferGeometry)
	const lineGeometry = useTrait(() => entity, traits.LineGeometry)
	const pointsGeometry = useTrait(() => entity, traits.PointsGeometry)

	const geometryType = $derived.by(() => {
		if (box.current) return 'box'
		if (capsule.current) return 'capsule'
		if (sphere.current) return 'sphere'
		if (bufferGeometry.current) return 'buffer'
		if (lineGeometry.current) return 'line'
		if (pointsGeometry.current) return 'points'
	})

	const color = $derived.by(() => {
		if (overrideColor) {
			return overrideColor
		}
		if (entityColor.current) {
			return colorUtil
				.setRGB(entityColor.current.r, entityColor.current.g, entityColor.current.b)
				.getHexString()
		}
		return colors.default
	})

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

	const entityPose = useTrait(() => entity, traits.Pose)
	const finalPose = $derived(pose ?? entityPose.current)
	$effect.pre(() => {
		if (finalPose) {
			poseToObject3d(finalPose, group)
			invalidate()
		}
	})

	let geo = $state.raw<BufferGeometry>()

	const oncreate = (ref: BufferGeometry) => {
		geo = ref
	}
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
			name={name.current}
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
					{@const points = entity.get(traits.LineGeometry)}
					<MeshLineGeometry points={points ?? []} />
				{:else if geometryType === 'box'}
					{@const box = entity.get(traits.Box)}
					<T.BoxGeometry
						args={[box?.x, box?.y, box?.z]}
						{oncreate}
					/>
				{:else if geometryType === 'sphere'}
					{@const sphere = entity.get(traits.Sphere)}
					<T.SphereGeometry
						args={[sphere?.r]}
						{oncreate}
					/>
				{:else if geometryType === 'capsule'}
					{@const capsule = entity.get(traits.Capsule)}
					<T
						is={CapsuleGeometry}
						args={[capsule?.r, capsule?.l]}
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
			name={name.current}
			width={3}
			length={0.1}
		/>
	{/if}

	{@render children?.({ ref: group })}
</T>
