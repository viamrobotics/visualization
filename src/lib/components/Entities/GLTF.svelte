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

	import { T, type Props as ThrelteProps, useThrelte } from '@threlte/core'
	import { type ThrelteGltf, useGltfAnimations } from '@threlte/extras'
	import { Group, type Object3D } from 'three'

	import { traits, useOpacity, useTrait } from '$lib/ecs'
	import { useSettings } from '$lib/hooks/useSettings.svelte'

	import { useEntityEvents } from './hooks/useEntityEvents.svelte'
	import { setModelOpacity } from './setModelOpacity'
	import { setModelWireframe } from './setModelWireframe'

	interface Props extends ThrelteProps<Object3D> {
		entity: Entity
		children?: Snippet
	}

	let { entity, children, ...rest }: Props = $props()

	const { invalidate } = useThrelte()
	const settings = useSettings()

	const { gltf, actions } = useGltfAnimations()

	const worldMatrix = useTrait(() => entity, traits.WorldMatrix)
	const gltfTrait = useTrait(() => entity, traits.GLTF)
	const invisible = useTrait(() => entity, traits.InheritedInvisible)
	const opacity = useOpacity(() => entity)
	const events = useEntityEvents(() => entity)

	const animationName = $derived(gltfTrait.current?.animationName)

	const group = new Group()
	group.matrixAutoUpdate = false

	$effect.pre(() => {
		if (worldMatrix.current) {
			group.matrix.copy(worldMatrix.current)
			group.updateMatrixWorld()
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

	// `castShadow` is not inherited, so setting it on the group the scene mounts
	// under would do nothing. Realistic mode is the only mode that renders shadows.
	$effect.pre(() => {
		$gltf?.scene.traverse((object) => {
			object.castShadow = true
			object.receiveShadow = true
		})
	})

	$effect.pre(() => {
		if (!$gltf) return
		setModelWireframe($gltf.scene, settings.current.renderMode === 'wireframe')
		invalidate()
	})

	// Each entity loads its own asset, so these materials are already its own.
	$effect(() => {
		if (!$gltf) return
		setModelOpacity($gltf.scene, opacity.current)
		invalidate()
	})
</script>

<T is={group}>
	{#if $gltf}
		<T
			is={$gltf.scene as Object3D}
			name={entity}
			visible={invisible.current !== true}
			{...events}
			{...rest}
		>
			{@render children?.()}
		</T>
	{/if}
</T>
