<script
	module
	lang="ts"
>
	import { GLTFLoader, DRACOLoader } from 'three/examples/jsm/Addons.js'

	const dracoLoader = new DRACOLoader()
	const gltfLoader = new GLTFLoader()

	dracoLoader.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.6/')
	gltfLoader.setDRACOLoader(dracoLoader)
</script>

<script lang="ts">
	import { T, type Props as ThrelteProps } from '@threlte/core'
	import { Portal, PortalTarget, useGltfAnimations, type ThrelteGltf } from '@threlte/extras'
	import type { Snippet } from 'svelte'
	import type { Object3D } from 'three'
	import { useObjectEvents } from '$lib/hooks/useObjectEvents.svelte'
	import type { Entity } from 'koota'
	import { traits, useTrait } from '$lib/ecs'

	interface Props extends ThrelteProps<Object3D> {
		entity: Entity
		children?: Snippet
	}

	let { entity, children, ...rest }: Props = $props()

	const { gltf, actions } = useGltfAnimations()

	const name = useTrait(() => entity, traits.Name)
	const parent = useTrait(() => entity, traits.Parent)
	const gltfTrait = useTrait(() => entity, traits.GLTF)
	const scale = useTrait(() => entity, traits.Scale)
	const objectProps = useObjectEvents(() => entity)

	const animationName = $derived(gltfTrait.current?.animationName)

	$effect(() => {
		if (!gltfTrait.current) {
			return
		}

		const { source } = gltfTrait.current

		const load = async () => {
			if ('url' in source) {
				$gltf = (await gltfLoader.loadAsync(source.url)) as ThrelteGltf
			} else if ('glb' in source) {
				$gltf = (await gltfLoader.parseAsync(source.glb.buffer, '')) as ThrelteGltf
			} else if ('gltf' in source) {
				$gltf = source.gltf as ThrelteGltf
			}
		}

		load()
	})

	$effect(() => {
		if (animationName) {
			$actions[animationName]?.play()
		}
	})
</script>

<Portal id={parent.current}>
	{#if $gltf}
		<T
			is={$gltf.scene as Object3D}
			scale={[scale.current?.x ?? 1, scale.current?.y ?? 1, scale.current?.z ?? 1]}
			name={name.current}
			{...objectProps}
			{...rest}
		>
			{@render children?.()}

			<PortalTarget id={name.current} />
		</T>
	{/if}
</Portal>
