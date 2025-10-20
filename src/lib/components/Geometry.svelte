<script lang="ts">
	import { T, type Props as ThrelteProps } from '@threlte/core'
	import { type Snippet } from 'svelte'
	import { meshBounds, MeshLineGeometry, MeshLineMaterial } from '@threlte/extras'
	import { BufferGeometry, DoubleSide, FrontSide, Group, Mesh } from 'three'
	import { CapsuleGeometry } from '$lib/three/CapsuleGeometry'
	import { poseToObject3d } from '$lib/transform'
	import { colors, darkenColor } from '$lib/color'
	import AxesHelper from './AxesHelper.svelte'
	import type { WorldObject } from '$lib/WorldObject.svelte'
	import { PLYLoader } from 'three/addons/loaders/PLYLoader.js'

	const plyLoader = new PLYLoader()

	interface Props extends ThrelteProps<Group> {
		uuid: string
		name: string
		geometry?: WorldObject['geometry']
		pose: WorldObject['pose']
		metadata: WorldObject['metadata']
		children?: Snippet<[{ ref: Group }]>
		color?: string
	}

	let {
		uuid,
		name,
		geometry,
		metadata,
		pose,
		color: overrideColor,
		children,
		...rest
	}: Props = $props()

	const type = $derived(geometry?.geometryType?.case)
	const color = $derived(overrideColor ?? metadata.color ?? colors.default)

	const group = new Group()
	const mesh = $derived.by(() => {
		if (type === undefined) {
			return
		}
		const result = new Mesh()

		if (type === 'mesh' || type === 'points' || type === 'line') {
			result.raycast = meshBounds
		}

		return result
	})

	$effect.pre(() => {
		if (geometry?.center && mesh) {
			poseToObject3d(geometry.center, mesh)
		}
	})

	$effect.pre(() => {
		poseToObject3d(pose, group)
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
	{#if geometry?.geometryType}
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
			{#if geometry.geometryType.case === 'mesh'}
				{@const mesh = geometry.geometryType.value.mesh as Uint8Array<ArrayBuffer>}
				{@const meshGeometry = plyLoader.parse(typeof mesh === 'string' ? atob(mesh) : mesh.buffer)}
				<T
					is={meshGeometry}
					{oncreate}
				/>
			{:else if geometry.geometryType.case === 'line' && metadata.points}
				<MeshLineGeometry points={metadata.points} />
			{:else if geometry.geometryType.case === 'box'}
				{@const dimsMm = geometry.geometryType.value.dimsMm ?? { x: 0, y: 0, z: 0 }}
				<T.BoxGeometry
					args={[dimsMm.x * 0.001, dimsMm.y * 0.001, dimsMm.z * 0.001]}
					{oncreate}
				/>
			{:else if geometry.geometryType.case === 'sphere'}
				{@const radiusMm = geometry.geometryType.value.radiusMm ?? 0}
				<T.SphereGeometry
					args={[radiusMm * 0.001]}
					{oncreate}
				/>
			{:else if geometry.geometryType.case === 'capsule'}
				{@const { lengthMm, radiusMm } = geometry.geometryType.value}
				<T
					is={CapsuleGeometry}
					args={[radiusMm * 0.001, lengthMm * 0.001]}
					{oncreate}
				/>
			{/if}

			{#if geometry.geometryType.case === 'line'}
				<MeshLineMaterial
					{color}
					width={metadata.lineWidth ?? 0.005}
				/>
			{:else}
				<T.MeshToonMaterial
					{color}
					side={geometry.geometryType.case === 'mesh' ? DoubleSide : FrontSide}
					transparent
					opacity={metadata.opacity ?? 0.7}
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
			{name}
			{uuid}
			width={3}
			length={0.1}
		/>
	{/if}

	{@render children?.({ ref: group })}
</T>
