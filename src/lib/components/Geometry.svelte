<script lang="ts">
	import { T, type Props as ThrelteProps } from '@threlte/core'
	import { type Snippet } from 'svelte'
	import { meshBounds, MeshLineGeometry, MeshLineMaterial } from '@threlte/extras'
	import { BufferGeometry, DoubleSide, FrontSide, Mesh, Object3D } from 'three'
	import { CapsuleGeometry } from '$lib/three/CapsuleGeometry'
	import { poseToObject3d } from '$lib/transform'
	import { colors, darkenColor } from '$lib/color'
	import AxesHelper from './AxesHelper.svelte'
	import type { WorldObject } from '$lib/WorldObject.svelte'
	import { PLYLoader } from 'three/addons/loaders/PLYLoader.js'

	const plyLoader = new PLYLoader()

	interface Props extends ThrelteProps<Object3D> {
		uuid: string
		name: string
		geometry?: WorldObject['geometry']
		pose: WorldObject['pose']
		metadata: WorldObject['metadata']
		children?: Snippet<[{ ref: Object3D }]>
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

	const type = $derived(geometry?.case)
	const mesh = $derived.by(() => {
		const object3d = type === undefined ? new Object3D() : new Mesh()

		if (type === 'mesh' || type === 'points' || type === 'line') {
			object3d.raycast = meshBounds
		}

		return object3d
	})

	$effect.pre(() => {
		poseToObject3d(pose, mesh)
	})

	let geo = $state.raw<BufferGeometry>()

	const oncreate = (ref: BufferGeometry) => {
		geo = ref
	}

	const color = $derived(overrideColor ?? metadata.color ?? colors.default)
</script>

<T
	is={mesh}
	{name}
	{uuid}
	{...rest}
	bvh={{ enabled: false }}
>
	{#if geometry?.case === 'mesh'}
		{@const mesh = geometry.value.mesh as Uint8Array<ArrayBuffer>}
		{@const meshGeometry = plyLoader.parse(typeof mesh === 'string' ? atob(mesh) : mesh.buffer)}
		<T
			is={meshGeometry}
			{oncreate}
		/>
	{:else if geometry?.case === 'line' && metadata.points}
		<MeshLineGeometry points={metadata.points} />
	{:else if geometry?.case === 'box'}
		{@const dimsMm = geometry.value.dimsMm ?? { x: 0, y: 0, z: 0 }}
		<T.BoxGeometry
			args={[dimsMm.x * 0.001, dimsMm.y * 0.001, dimsMm.z * 0.001]}
			{oncreate}
		/>
	{:else if geometry?.case === 'sphere'}
		{@const radiusMm = geometry.value.radiusMm ?? 0}
		<T.SphereGeometry
			args={[radiusMm * 0.001]}
			{oncreate}
		/>
	{:else if geometry?.case === 'capsule'}
		{@const { lengthMm, radiusMm } = geometry.value}
		<T
			is={CapsuleGeometry}
			args={[radiusMm * 0.001, lengthMm * 0.001]}
			{oncreate}
		/>
	{:else}
		<AxesHelper
			width={3}
			length={0.1}
		/>
	{/if}

	{#if geometry?.case === 'line'}
		<MeshLineMaterial
			{color}
			width={metadata.lineWidth ?? 0.005}
		/>
	{:else if geometry}
		<T.MeshToonMaterial
			{color}
			side={geometry.case === 'mesh' ? DoubleSide : FrontSide}
			transparent
			opacity={0.7}
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

	{@render children?.({ ref: mesh })}
</T>
