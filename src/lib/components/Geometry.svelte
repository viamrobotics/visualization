<script lang="ts">
	import { T, useThrelte, type Props as ThrelteProps } from '@threlte/core'
	import { type Snippet } from 'svelte'
	import { meshBounds } from '@threlte/extras'
	import { BufferGeometry, Color, DoubleSide, FrontSide, Group, Mesh } from 'three'
	import { Line2, LineGeometry, LineMaterial } from 'three/examples/jsm/Addons.js'
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
		ref?: Group
		children?: Snippet<[{ ref: Group }]>
	}

	let {
		entity,
		color: overrideColor,
		model,
		renderMode = 'colliders',
		pose,
		ref = $bindable(),
		children,
		...rest
	}: Props = $props()

	const colorUtil = new Color()

	const { invalidate } = useThrelte()
	const name = useTrait(() => entity, traits.Name)
	const entityColor = useTrait(() => entity, traits.Color)
	const opacity = useTrait(() => entity, traits.Opacity)
	const box = useTrait(() => entity, traits.Box)
	const capsule = useTrait(() => entity, traits.Capsule)
	const sphere = useTrait(() => entity, traits.Sphere)
	const bufferGeometry = useTrait(() => entity, traits.BufferGeometry)
	const linePositions = useTrait(() => entity, traits.LinePositions)
	const lineWidth = useTrait(() => entity, traits.LineWidth)
	const center = useTrait(() => entity, traits.Center)
	const showAxesHelper = useTrait(() => entity, traits.ShowAxesHelper)

	const geometryType = $derived.by(() => {
		if (box.current) return 'box'
		if (capsule.current) return 'capsule'
		if (sphere.current) return 'sphere'
		if (bufferGeometry.current) return 'buffer'
		if (linePositions.current) return 'line'
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
	ref = group

	const mesh = $derived.by(() => {
		if (geometryType === undefined) {
			return
		}

		const result = geometryType === 'line' ? new Line2() : new Mesh()

		if (geometryType === 'line') {
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

	const oncreate = (bufferGeometry: BufferGeometry) => {
		geo = bufferGeometry
	}

	$effect.pre(() => {
		if (mesh && bufferGeometry.current) {
			mesh.geometry = bufferGeometry.current
			oncreate(bufferGeometry.current)

			return () => {
				geo = undefined
				mesh?.geometry?.dispose()
			}
		}
	})
</script>

<T
	is={group}
	{...rest}
>
	{#if geometryType}
		{#if showAxesHelper.current}
			<AxesHelper
				width={3}
				length={0.1}
			/>
		{/if}

		<T
			is={mesh}
			name={entity}
			userData.name={name}
		>
			{#if model && renderMode.includes('model')}
				<T is={model} />
			{/if}

			{#if !model || renderMode.includes('colliders')}
				{#if linePositions.current}
					<T
						is={LineGeometry}
						oncreate={(ref) => {
							if (linePositions.current) {
								ref.setPositions(linePositions.current)
							}
						}}
					/>
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

			{#if linePositions.current}
				<T
					is={LineMaterial}
					{color}
					width={lineWidth.current ? lineWidth.current * 0.001 : 0.5}
				/>
			{:else}
				{@const currentOpacity = opacity.current ?? 0.7}
				<T.MeshToonMaterial
					{color}
					side={geometryType === 'buffer' ? DoubleSide : FrontSide}
					transparent={currentOpacity < 1}
					depthWrite={currentOpacity === 1}
					opacity={currentOpacity ?? 0.7}
				/>

				{#if geo && (renderMode.includes('colliders') || !model)}
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
	{:else if showAxesHelper.current}
		<AxesHelper
			name={name.current}
			width={3}
			length={0.1}
		/>
	{/if}

	{@render children?.({ ref: group })}
</T>
