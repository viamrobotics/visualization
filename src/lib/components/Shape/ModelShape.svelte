<!--

This component is consumed as a library export
and should remain pure, i.e. no hooks should be used.

-->
<script lang="ts">
	import { T, useTask } from '@threlte/core'
	import { AnimationMixer, Group } from 'three'
	import type { AnimationClip, Object3D } from 'three'
	import type { GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js'
	import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
	import type { ModelGeometry } from '$lib/shape'
	import { noop } from 'lodash-es'
	import type { Metadata } from '$lib/WorldObject.svelte'
	import { Vector3 } from 'three'
	import type { PlainMessage } from '@bufbuild/protobuf'
	import type { ModelAsset } from '$lib/gen/draw/v1/drawing_pb'
	interface Props {
		geometry: ModelGeometry
		metadata: Metadata
	}

	let { geometry, metadata }: Props = $props()

	const loader = new GLTFLoader()

	let scene = $state<Object3D | undefined>(undefined)
	let gltfs = $state<GLTF[]>([])
	let animations = $state<AnimationClip[]>([])

	let update: (delta: number) => void = noop

	const shouldAnimate = $derived(Boolean(geometry.geometryType.value.animationName !== ''))
	const scale = $derived(geometry.geometryType.value.scale ?? new Vector3(1, 1, 1))

	useTask((delta) => {
		update(delta)
	})

	const handleLoad = (loadedGltf: GLTF) => {
		gltfs = [...gltfs, loadedGltf]
		animations = [...animations, ...loadedGltf.animations]
		console.log('animations', animations)
		scene?.add(loadedGltf.scene)
		scene?.animations.push(...animations)
		console.log('scene?.animations', scene?.animations)
	}

	const handleError = (error: unknown) => {
		console.error('Failed to load model', error)
	}

	const handleAsset = async (asset: PlainMessage<ModelAsset>) => {
		if (asset.content.case === 'url') {
			loader.load(asset.content.value, handleLoad, undefined, handleError)
		} else if (asset.content.case === 'binary') {
			const arrayBuffer = asset.content.value.buffer.slice(
				asset.content.value.byteOffset,
				asset.content.value.byteOffset + asset.content.value.byteLength
			)

			try {
				const loadedGltf = await loader.parseAsync(arrayBuffer as ArrayBuffer, '')
				handleLoad(loadedGltf)
			} catch (error) {
				handleError(error)
			}
		} else {
			console.error('No content specified for asset', asset)
		}
	}

	$effect.pre(() => {
		if (scene) {
			scene.scale.set(scale.x, scale.y, scale.z)
		}
	})

	$effect(() => {
		// Depend on gltfs.length to re-run when GLTFs are loaded
		if (shouldAnimate && scene && gltfs.length > 0) {
			const mixer = new AnimationMixer(scene)
			update = (delta) => mixer.update(delta)

			const clip = scene.animations.find(
				(animation) => animation.name === geometry.geometryType.value.animationName
			)
			if (!clip) {
				console.warn(
					`Animation ${geometry.geometryType.value.animationName} for model ${geometry.label} not found`
				)
			} else {
				const action = mixer.clipAction(clip)
				action.play()
			}

			return () => {
				mixer.stopAllAction()
				update = noop
			}
		}
	})

	$effect(() => {
		const assets = geometry.geometryType.value.assets
		if (assets.length === 0) {
			console.error('No assets specified', geometry)
			return
		}

		scene = new Group()
		gltfs = []
		update = noop

		for (const asset of assets) {
			void handleAsset(asset)
		}
	})
</script>

{#if scene}
	<T
		is={scene}
		{...metadata}
	/>
{/if}
