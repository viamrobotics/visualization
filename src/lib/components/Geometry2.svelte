<script lang="ts">
	import { T, useThrelte, type Props as ThrelteProps } from '@threlte/core'
	import { type Snippet } from 'svelte'
	import {
		meshBounds,
		MeshLineMaterial,
		MeshLineGeometry,
		Portal,
		PortalTarget,
	} from '@threlte/extras'
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
	const parent = useTrait(() => entity, traits.Parent)
	const entityColor = useTrait(() => entity, traits.Color)
	const opacity = useTrait(() => entity, traits.Opacity)
	const box = useTrait(() => entity, traits.Box)
	const capsule = useTrait(() => entity, traits.Capsule)
	const sphere = useTrait(() => entity, traits.Sphere)
	const bufferGeometry = useTrait(() => entity, traits.BufferGeometry)
	const lineGeometry = useTrait(() => entity, traits.LineGeometry)
	const pointsGeometry = useTrait(() => entity, traits.PointsGeometry)
	const center = useTrait(() => entity, traits.Center)

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

	$effect.pre(() => {
		if (mesh && center.current) {
			poseToObject3d(center.current, mesh)
			invalidate()
		}
	})

	const entityPose = useTrait(() => entity, traits.Pose)
	const resolvedPose = $derived(pose ?? entityPose.current)
	$effect.pre(() => {
		if (resolvedPose) {
			poseToObject3d(resolvedPose, group)
			invalidate()
		}
	})

	let geo = $state.raw<BufferGeometry>()

	const oncreate = (ref: BufferGeometry) => {
		geo = ref
	}
</script>

<Portal id={parent.current}>
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
				bvh={{ enabled: bufferGeometry.current !== undefined }}
			>
				{#if model && renderMode.includes('model')}
					<T is={model} />
				{/if}

				{#if !model || renderMode.includes('colliders')}
					{#if bufferGeometry.current}
						<T
							is={bufferGeometry.current}
							{oncreate}
						/>
					{:else if lineGeometry.current}
						<MeshLineGeometry points={lineGeometry.current} />
					{:else if box.current}
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
					{/if}
				{/if}

				{#if lineGeometry.current}
					<MeshLineMaterial
						{color}
						width={0.005}
					/>
				{:else}
					<T.MeshToonMaterial
						{color}
						side={geometryType === 'buffer' ? DoubleSide : FrontSide}
						transparent
						opacity={opacity.current ?? 0.7}
					/>

					{#if geo}
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

		{#if name.current}
			<PortalTarget id={name.current} />
		{/if}
	</T>
</Portal>
