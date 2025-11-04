<script lang="ts">
	import { isInstanceOf, useTask, useThrelte } from '@threlte/core'
	import {
		BlendFunction,
		EffectComposer,
		EffectPass,
		OutlineEffect,
		SMAAEffect,
		RenderPass,
		SMAAPreset,
	} from 'postprocessing'
	import { useSelectedObject3d } from '$lib/hooks/useSelection.svelte'
	import { Color } from 'three'

	const object3d = useSelectedObject3d()

	const { scene, renderer, camera, size, autoRender, renderStage } = useThrelte()

	scene.background = new Color(0xffffff)
	const composer = new EffectComposer(renderer)

	const renderPass = new RenderPass(scene)
	composer.addPass(renderPass)

	$effect(() => {
		composer.setSize($size.width, $size.height)
	})

	const selectionColor = 0xffff00
	const outlineEffect = new OutlineEffect(scene, undefined, {
		blendFunction: BlendFunction.ALPHA,
		edgeStrength: 5,
		pulseSpeed: 0.0,
		multisampling: 8,
		blur: true,
		visibleEdgeColor: selectionColor,
		hiddenEdgeColor: selectionColor,
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

	const smaaEffect = new SMAAEffect({ preset: SMAAPreset.HIGH })

	const effectPass = new EffectPass(undefined, outlineEffect, smaaEffect)
	composer.addPass(effectPass)

	$effect(() => {
		renderPass.mainCamera = $camera
		outlineEffect.mainCamera = $camera
		effectPass.mainCamera = $camera
	})

	$effect(() => {
		return () => {
			composer.removeAllPasses()
			effectPass.dispose()
			renderPass.dispose()
			composer.dispose()
		}
	})

	$effect(() => {
		const last = autoRender.current
		autoRender.set(false)
		return () => {
			autoRender.set(last)
		}
	})

	useTask(
		(delta) => {
			composer.render(delta)
		},
		{ stage: renderStage, autoInvalidate: false }
	)
</script>
