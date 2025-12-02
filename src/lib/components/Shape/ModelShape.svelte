<!--

This component is consumed as a library export
and should remain pure, i.e. no hooks should be used.

-->
<script lang="ts">
	import { T, useTask } from '@threlte/core'
	import { AnimationMixer } from 'three'
	import type { Object3D } from 'three'
	import type { GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js'
	import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
	import type { ModelGeometry } from '$lib/shape'
	import { noop } from 'lodash-es'
	import type { Metadata } from '$lib/WorldObject.svelte'

	interface Props {
		geometry: ModelGeometry
		metadata: Metadata
	}

	let { geometry, metadata }: Props = $props()

	const loader = new GLTFLoader()

	let scene = $state<Object3D | undefined>(undefined)
	let gltf = $state<GLTF | undefined>(undefined)

	let update: (delta: number) => void = noop

	const animations = $derived(gltf?.animations ?? [])
	const isAnimated = $derived(animations.length > 0)
	const shouldAnimate = $derived(isAnimated && Boolean(geometry.geometryType.value.animate))
	const scale = $derived(geometry.geometryType.value.scale ?? 1.0)

	// Update the animation mixer each frame
	useTask((delta) => {
		update(delta)
	})

	$effect.pre(() => {
		if (scene) {
			scene.scale.setScalar(scale)
		}
	})

	// Set up and play animations when gltf is loaded
	$effect(() => {
		if (shouldAnimate && scene) {
			// Create animation mixer
			const mixer = new AnimationMixer(scene)
			update = (delta) => mixer.update(delta)

			// Play all animations
			animations.forEach((clip) => {
				const action = mixer.clipAction(clip)
				action.play()
			})

			// Cleanup when effect reruns
			return () => {
				mixer.stopAllAction()
				update = noop
			}
		}
	})

	$effect(() => {
		const modelType = geometry.geometryType.value.modelType
		if (!modelType) {
			console.error('No model type specified', geometry)
			return
		}

		scene = undefined
		gltf = undefined
		update = noop

		if (modelType.case === 'url') {
			// Load from URL
			loader.load(
				modelType.value,
				(loadedGltf) => {
					gltf = loadedGltf
					scene = loadedGltf.scene
					scene.scale.setScalar(scale)
					console.log(`ModelShape: Loaded model with ${loadedGltf.animations.length} animation(s)`)
				},
				undefined,
				(err: unknown) => {
					console.error('Failed to load model', err)
				}
			)
		} else if (modelType.case === 'glb') {
			// Load from GLB bytes - create a new ArrayBuffer to ensure it's not SharedArrayBuffer
			const uint8Array = new Uint8Array(modelType.value)
			const blob = new Blob([uint8Array], { type: 'model/gltf-binary' })
			const url = URL.createObjectURL(blob)

			loader.load(
				url,
				(loadedGltf) => {
					gltf = loadedGltf
					scene = loadedGltf.scene
					scene.scale.setScalar(scale)
					URL.revokeObjectURL(url)
				},
				undefined,
				(err: unknown) => {
					console.error('Failed to load GLB', err)
					URL.revokeObjectURL(url)
				}
			)
		}
	})
</script>

{#if scene}
	<T
		is={scene}
		{...metadata}
	/>
{/if}
