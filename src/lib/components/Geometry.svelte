<script lang="ts">
	import { T, type Props as ThrelteProps } from '@threlte/core'
	import { type Snippet } from 'svelte'
	import { meshBounds, MeshLineGeometry, MeshLineMaterial } from '@threlte/extras'
	import { BufferGeometry, DoubleSide, FrontSide, Group, Mesh } from 'three'
	import type { Geometry } from '@viamrobotics/sdk'
	import { CapsuleGeometry } from '$lib/three/CapsuleGeometry'
	import { poseToObject3d } from '$lib/transform'
	import { colors, darkenColor } from '$lib/color'
	import AxesHelper from './AxesHelper.svelte'
	import type { WorldObject } from '$lib/WorldObject.svelte'
	import { PLYLoader } from 'three/addons/loaders/PLYLoader.js'
	import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
	import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js'
	import { WEBLAB_EXPERIMENTS } from '$lib/hooks/useWeblabs.svelte'
	import { useSettings } from '$lib/hooks/useSettings.svelte'
	import { useWeblabs } from '$lib/hooks/useWeblabs.svelte'
	import { use3DModels } from '$lib/hooks/use3DModels.svelte'
	const settings = useSettings()
	const plyLoader = new PLYLoader()
	const gltfLoader = new GLTFLoader()
	const dracoLoader = new DRACOLoader()
	dracoLoader.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.6/')
	gltfLoader.setDRACOLoader(dracoLoader)
	const weblabs = useWeblabs()
	const componentModels = use3DModels()
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

	const geoModel = $derived.by<Geometry>(() => {
		const [componentName, id] = name.split(':')
		if (!componentName || !id) {
			return undefined
		}
		if (!componentModels.current[componentName]) {
			return undefined
		}
		const geometry = componentModels.current[componentName][id]
		if (!geometry) {
			return undefined
		}
		return geometry
	})

	let gltfModel = $state.raw<Group>()

	$effect(() => {
		if (geoModel?.geometryType?.case !== 'mesh') {
			return
		}
		const mesh = geoModel.geometryType.value.mesh
		if (!mesh) {
			return
		}

		const arrayBuffer = mesh.buffer.slice(mesh.byteOffset, mesh.byteOffset + mesh.byteLength)

		gltfLoader.parseAsync(arrayBuffer, '').then((result) => {
			gltfModel = result.scene
		})
	})

	const type = $derived(geometry?.geometryType?.case)
	const color = $derived(overrideColor ?? metadata.color ?? colors.default)
	const renderModels = $derived(
		(settings.current.renderArmModels === 'model' ||
			settings.current.renderArmModels === 'colliders+model') &&
			gltfModel
	)
	const renderPrimitives = $derived(
		settings.current.renderArmModels === 'colliders' ||
			settings.current.renderArmModels === 'colliders+model' ||
			!gltfModel
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
				<T is={gltfModel} />
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
