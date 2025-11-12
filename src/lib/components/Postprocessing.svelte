<script lang="ts">
	import { isInstanceOf, useTask, useThrelte } from '@threlte/core'
	import {
		BlendFunction,
		EffectComposer,
		EffectPass,
		OutlineEffect,
		RenderPass,
	} from 'postprocessing'
	import { useSelectedObject3d } from '$lib/hooks/useSelection.svelte'
	import { Color } from 'three'

	const object3d = useSelectedObject3d()

	const { scene, renderer, camera, size, autoRender, renderStage, shouldRender } = useThrelte()

	scene.background = new Color(0xffffff)
	const composer = new EffectComposer(renderer)
	composer.multisampling = renderer.capabilities.maxSamples

	const renderPass = new RenderPass(scene)
	composer.addPass(renderPass)

	$effect(() => {
		composer.setSize($size.width, $size.height)
	})

	const selectionColor = 0xffff00
	const outlineEffect = new OutlineEffect(scene, undefined, {
		blendFunction: BlendFunction.ALPHA,
		edgeStrength: 5,
		pulseSpeed: 0,
		blur: true,
		visibleEdgeColor: selectionColor,
		hiddenEdgeColor: selectionColor,
	})

	$effect(() => {
		outlineEffect.resolution.setPreferredSize($size.width / 3, $size.height / 3)
	})

	$effect(() => {
		object3d.current?.traverse((child) => {
			if (isInstanceOf(child, 'Mesh')) {
				outlineEffect.selection.add(child)
			}
		})

		return () => {
			outlineEffect.selection.clear()
		}
	})

	const effectPass = new EffectPass($camera, outlineEffect)
	composer.addPass(effectPass)

	$effect.pre(() => {
		renderPass.mainCamera = $camera
		outlineEffect.mainCamera = $camera
		effectPass.mainCamera = $camera
	})

	$effect.pre(() => {
		return () => {
			composer.removeAllPasses()
			effectPass.dispose()
			renderPass.dispose()
			composer.dispose()
		}
	})

	$effect.pre(() => {
		const last = autoRender.current
		autoRender.set(false)
		return () => {
			autoRender.set(last)
		}
	})

	useTask(
		(delta) => {
			if (shouldRender()) {
				composer.render(delta)
			}
		},
		{
			stage: renderStage,
			autoInvalidate: false,
		}
	)
</script>
