<script lang="ts">
	import { T } from '@threlte/core'
	import { Portal, PortalTarget } from '@threlte/extras'
	import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
	import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js'
	import { AnimationMixer, type Object3D } from 'three'
	import { useTask } from '@threlte/core'
	import type { Snippet } from 'svelte'
	import type { Entity } from 'koota'
	import { traits, useTrait } from '$lib/ecs'

	interface Props {
		entity: Entity
		children?: Snippet
	}

	let { entity, children }: Props = $props()

	const name = useTrait(() => entity, traits.Name)
	const parent = useTrait(() => entity, traits.Parent)
	const urlContent = useTrait(() => entity, traits.URLContent)
	const dataContent = useTrait(() => entity, traits.DataContent)
	const scale = useTrait(() => entity, traits.Scale)
	const animationName = useTrait(() => entity, traits.AnimationName)
	const gltfLoader = new GLTFLoader()
	const dracoLoader = new DRACOLoader()
	dracoLoader.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.6/')
	gltfLoader.setDRACOLoader(dracoLoader)

	let scene = $state<Object3D | undefined>(undefined)
	let mixer = $state<AnimationMixer | undefined>(undefined)

	$effect(() => {
		const loadModel = async () => {
			try {
				let gltf

				if (urlContent.current?.case === 'url' && urlContent.current.value) {
					gltf = await gltfLoader.loadAsync(urlContent.current.value)
				} else if (dataContent.current?.case === 'data' && dataContent.current.value?.length > 0) {
					const buffer = dataContent.current.value.buffer.slice(
						dataContent.current.value.byteOffset,
						dataContent.current.value.byteOffset + dataContent.current.value.byteLength
					)
					gltf = await gltfLoader.parseAsync(buffer as ArrayBuffer, '')
				}

				if (gltf) {
					scene = gltf.scene

					if (animationName.current && gltf.animations.length > 0) {
						mixer = new AnimationMixer(gltf.scene)
						const clip = gltf.animations.find((a) => a.name === animationName.current)
						if (clip) {
							mixer.clipAction(clip).play()
						} else if (gltf.animations[0]) {
							mixer.clipAction(gltf.animations[0]).play()
						}
					}
				}
			} catch (error) {
				console.warn(`Failed to load model for entity ${name.current}:`, error)
			}
		}

		loadModel()

		return () => {
			mixer?.stopAllAction()
			scene?.traverse((obj) => {
				if ('geometry' in obj && obj.geometry) {
					;(obj.geometry as { dispose?: () => void }).dispose?.()
				}
				if ('material' in obj && obj.material) {
					const material = obj.material as { dispose?: () => void } | { dispose?: () => void }[]
					if (Array.isArray(material)) {
						material.forEach((m) => m.dispose?.())
					} else {
						material.dispose?.()
					}
				}
			})
		}
	})

	const { start, stop } = useTask(
		(delta) => {
			mixer?.update(delta)
		},
		{ autoStart: false }
	)

	$effect(() => {
		if (mixer) {
			start()
		} else {
			stop()
		}
	})

	const scaleArray = $derived.by<[number, number, number]>(() => {
		if (scale.current) {
			return [scale.current.x, scale.current.y, scale.current.z]
		}
		return [1, 1, 1]
	})
</script>

<Portal id={parent.current}>
	{#if scene}
		<T
			is={scene}
			name={name.current}
			scale={scaleArray}
		>
			{@render children?.()}
			<PortalTarget id={name.current ?? ''} />
		</T>
	{/if}
</Portal>
