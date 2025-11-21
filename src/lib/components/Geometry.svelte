<!--

This component is consumed as a library export
and should remain pure, i.e. no hooks should be used.

-->
<script lang="ts">
	import { T, type Props as ThrelteProps } from '@threlte/core'
	import { type Snippet } from 'svelte'
	import { meshBounds, MeshLineGeometry, MeshLineMaterial } from '@threlte/extras'
	import { BufferGeometry, Color, DoubleSide, FrontSide, Group, Mesh, Vector3 } from 'three'
	import { CapsuleGeometry } from '$lib/three/CapsuleGeometry'
	import { poseToObject3d } from '$lib/transform'
	import { colors, darkenColor } from '$lib/color'
	import AxesHelper from './AxesHelper.svelte'
	import type { ArrowsGeometry, WorldObject } from '$lib/WorldObject.svelte'
	import { PLYLoader } from 'three/addons/loaders/PLYLoader.js'
	import { BatchedArrow } from '$lib/three/BatchedArrow'

	const plyLoader = new PLYLoader()

	interface Props extends ThrelteProps<Group> {
		uuid: string
		name: string
		geometry?: WorldObject['geometry']
		pose: WorldObject['pose']
		metadata: WorldObject['metadata']
		color?: string
		model?: Group
		renderMode?: 'model' | 'colliders' | 'colliders+model'
		children?: Snippet<[{ ref: Group }]>
	}

	let {
		uuid,
		name,
		geometry,
		metadata,
		pose,
		color: overrideColor,
		model,
		renderMode = 'colliders',
		children,
		...rest
	}: Props = $props()

	const type = $derived(geometry?.geometryType?.case)
	const color = $derived(overrideColor ?? metadata.color ?? colors.default)

	const group = new Group()

	const arrowLength = 0.1
	const arrowHeadAtPose = true
	const arrowColor = new Color()
	const arrowOrigin = new Vector3()
	const arrowDirection = new Vector3()

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

	const parsePlyInput = (mesh: string | Uint8Array): BufferGeometry => {
		// Case 1: already a base64 or ASCII string
		if (typeof mesh === 'string') {
			return plyLoader.parse(atob(mesh))
		}

		// Case 2: detect text vs binary PLY in Uint8Array
		const header = new TextDecoder().decode(mesh.slice(0, 50))
		const isAscii = header.includes('format ascii')

		// Case 3: text-mode PLY → decode bytes to string
		if (isAscii) {
			const text = new TextDecoder().decode(mesh)
			return plyLoader.parse(text)
		}

		// Case 4: binary PLY → pass ArrayBuffer directly
		return plyLoader.parse(mesh.buffer as ArrayBuffer)
	}

	const getArrowBatch = (arrows: ArrowsGeometry) => {
		const batchedArrow = new BatchedArrow()
		const { poses: posesBytes, colorCount, colors: colorsBytes } = arrows.geometryType.value

		const poses = new Float32Array(
			posesBytes.buffer,
			posesBytes.byteOffset,
			posesBytes.byteLength / 4
		)

		const colors = new Float32Array(
			colorsBytes.buffer,
			colorsBytes.byteOffset,
			colorsBytes.byteLength / 4
		)

		const singleColor = colorCount === 1

		if (singleColor) {
			arrowColor.setRGB(colors[0], colors[1], colors[2])
		}

		for (let i = 0; i < poses.length; i += 6) {
			arrowOrigin.set(poses[i], poses[i + 1], poses[i + 2]).multiplyScalar(0.001)
			arrowDirection.set(poses[i + 3], poses[i + 4], poses[i + 5])

			if (!singleColor) {
				const colorIndex = (i / 6) * 3
				arrowColor.setRGB(colors[colorIndex], colors[colorIndex + 1], colors[colorIndex + 2])
			}

			batchedArrow.addArrow(arrowDirection, arrowOrigin, arrowLength, arrowColor, arrowHeadAtPose)
		}

		return batchedArrow
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
			{#if model && renderMode.includes('model')}
				<T is={model} />
			{/if}

			{#if renderMode.includes('colliders')}
				{#if geometry.geometryType.case === 'bufferGeometry'}
					<T
						is={geometry.geometryType.value}
						{oncreate}
					/>
				{:else if geometry.geometryType.case === 'mesh'}
					{@const mesh = geometry.geometryType.value.mesh}
					{@const meshGeometry = parsePlyInput(mesh)}
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
				{:else if geometry.geometryType.case === 'arrows'}
					{@const batch = getArrowBatch(geometry as ArrowsGeometry)}
					<T
						name={batch.object3d.name}
						is={batch.object3d}
						dispose={false}
						bvh={{ enabled: false }}
					/>
				{/if}
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
			{name}
			{uuid}
			width={3}
			length={0.1}
		/>
	{/if}

	{@render children?.({ ref: group })}
</T>
