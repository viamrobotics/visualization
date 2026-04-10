<script
	module
	lang="ts"
>
	import { DRACOLoader, GLTFLoader } from 'three/examples/jsm/Addons.js'

	const dracoLoader = new DRACOLoader()
	const gltfLoader = new GLTFLoader()

	dracoLoader.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.6/')
	gltfLoader.setDRACOLoader(dracoLoader)
</script>

<script lang="ts">
	import type { Entity } from 'koota'
	import type { Snippet } from 'svelte'

	import { T, type Props as ThrelteProps } from '@threlte/core'
	import { Portal, PortalTarget, type ThrelteGltf, useGltfAnimations } from '@threlte/extras'
	import { Group, type Object3D } from 'three'

	import { traits, useTrait } from '$lib/ecs'
	import { poseToObject3d } from '$lib/transform'

	import AxesHelper from '../AxesHelper.svelte'
	import { useEntityEvents } from './hooks/useEntityEvents.svelte'

	interface Props extends ThrelteProps<Object3D> {
		entity: Entity
		children?: Snippet
	}

	let { entity, children, ...rest }: Props = $props()

	const { gltf, actions } = useGltfAnimations()

	const name = useTrait(() => entity, traits.Name)
	const parent = useTrait(() => entity, traits.Parent)
	const pose = useTrait(() => entity, traits.Pose)
	const gltfTrait = useTrait(() => entity, traits.GLTF)
	const scale = useTrait(() => entity, traits.Scale)
	const invisible = useTrait(() => entity, traits.Invisible)
	const showAxesHelper = useTrait(() => entity, traits.ShowAxesHelper)
	const events = useEntityEvents(() => entity)

	const animationName = $derived(gltfTrait.current?.animationName)

	const group = new Group()

	$effect.pre(() => {
		if (pose.current) {
			poseToObject3d(pose.current, group)
		}
	})

	$effect.pre(() => {
		if (!gltfTrait.current) {
			return
		}

		const { source } = gltfTrait.current

		const load = async () => {
			if ('url' in source) {
				$gltf = (await gltfLoader.loadAsync(source.url)) as ThrelteGltf
			} else if ('glb' in source) {
				const buffer = source.glb.buffer.slice(
					source.glb.byteOffset,
					source.glb.byteOffset + source.glb.byteLength
				) as ArrayBuffer
				$gltf = (await gltfLoader.parseAsync(buffer, '')) as ThrelteGltf
			} else if ('gltf' in source) {
				$gltf = source.gltf as ThrelteGltf
			}
		}

		load()
	})

	$effect.pre(() => {
		if (animationName) {
			$actions[animationName]?.play()
		}
	})
</script>

<Portal id={parent.current}>
	<T is={group}>
		{#if showAxesHelper.current}
			<AxesHelper
				name={entity}
				width={3}
				length={0.1}
			/>
		{/if}
		{#if $gltf}
			<T
				is={$gltf.scene as Object3D}
				scale={[scale.current?.x ?? 1, scale.current?.y ?? 1, scale.current?.z ?? 1]}
				name={entity}
				visible={invisible.current !== true}
				{...events}
				{...rest}
			>
				{@render children?.()}

				{#if name.current}
					<PortalTarget id={name.current} />
				{/if}
			</T>
		{/if}
	</T>
</Portal>
