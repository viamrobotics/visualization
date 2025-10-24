<script lang="ts">
	import { T, type Props as ThrelteProps } from '@threlte/core'
	import { type Snippet } from 'svelte'
	import { meshBounds, MeshLineGeometry, MeshLineMaterial } from '@threlte/extras'
	import { BufferGeometry, DoubleSide, FrontSide, Group, Mesh, type Object3D } from 'three'
	import { CapsuleGeometry } from '$lib/three/CapsuleGeometry'
	import { poseToObject3d } from '$lib/transform'
	import { colors, darkenColor } from '$lib/color'
	import AxesHelper from './AxesHelper.svelte'
	import type { WorldObject } from '$lib/WorldObject.svelte'
	import { PLYLoader } from 'three/addons/loaders/PLYLoader.js'
	import { useGltf, useDraco } from '@threlte/extras'
	import { WEBLAB_EXPERIMENTS } from '$lib/hooks/useWeblabs.svelte'
	import { useSettings } from '$lib/hooks/useSettings.svelte'
	import { useWeblabs } from '$lib/hooks/useWeblabs.svelte'

	const settings = useSettings()
	const plyLoader = new PLYLoader()
	const dracoLoader = useDraco()
	const weblabs = useWeblabs()

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

	const upperArmGltf = useGltf('/models/upper_arm_link.glb', { dracoLoader })
	const baseLinkGltf = useGltf('/models/base_link.glb', { dracoLoader })
	const forearmLinkGltf = useGltf('/models/forearm_link.glb', { dracoLoader })
	const wrist1LinkGltf = useGltf('/models/wrist_1_link.glb', { dracoLoader })
	const eeLinkGltf = useGltf('/models/ee_link.glb', { dracoLoader })

	const labelToGlbPath = $derived<Record<string, { scene: Object3D | undefined }>>({
		'ur5e:upper_arm_link': { scene: $upperArmGltf?.scene },
		'ur5e:base_link': { scene: $baseLinkGltf?.scene },
		'ur5e:forearm_link': { scene: $forearmLinkGltf?.scene },
		'ur5e:wrist_1_link': { scene: $wrist1LinkGltf?.scene },
		'ur5e:ee_link': { scene: $eeLinkGltf?.scene },
	})

	const type = $derived(geometry?.geometryType?.case)
	const color = $derived(overrideColor ?? metadata.color ?? colors.default)
	const renderModels = $derived(
		(settings.current.renderArmModels === 'model' ||
			settings.current.renderArmModels === 'colliders+model') &&
			labelToGlbPath[name] &&
			labelToGlbPath[name]?.scene
	)
	const renderPrimitives = $derived(
		settings.current.renderArmModels === 'colliders' ||
			settings.current.renderArmModels === 'colliders+model' ||
			!labelToGlbPath[name] ||
			!labelToGlbPath[name]?.scene
	)

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

	$effect.pre(() => {
		if (
			weblabs.isActive(WEBLAB_EXPERIMENTS.MOTION_TOOLS_RENDER_ARM_MODELS) &&
			renderModels &&
			!renderPrimitives
		) {
			geo = undefined
		}
	})

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
			{#if weblabs.isActive(WEBLAB_EXPERIMENTS.MOTION_TOOLS_RENDER_ARM_MODELS) && renderModels}
				<T is={labelToGlbPath[name].scene} />
			{/if}

			{#if !weblabs.isActive(WEBLAB_EXPERIMENTS.MOTION_TOOLS_RENDER_ARM_MODELS) || renderPrimitives}
				{#if geometry.geometryType.case === 'mesh'}
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
