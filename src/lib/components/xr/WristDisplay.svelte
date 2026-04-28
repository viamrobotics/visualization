<script lang="ts">
	import type { Snippet } from 'svelte'

	import { T } from '@threlte/core'
	import { useController, useHandJoint } from '@threlte/xr'
	import { fromStore } from 'svelte/store'
	import { Group, type Vector3Tuple } from 'three'
	import { provideDefaultProperties } from 'threlte-uikit'

	interface Props {
		/** Offset from the wrist in the wrist-local frame, meters. */
		position?: Vector3Tuple
		/**
		 * Rotation in the wrist-local frame. The default orients uikit content
		 * (panels face their own +Z) onto the dorsal side of the wrist, so the
		 * user sees it when turning their palm down, like a smartwatch.
		 */
		rotation?: Vector3Tuple
		/** Uniform scale for the wrist group. Smaller than the HUD default
		 *  because panels live at arm's length instead of ~1 m away. */
		scale?: number
		children?: Snippet
	}

	const {
		position = [0, 0.005, 0.08],
		rotation = [-Math.PI / 2, 0, 0],
		scale = 0.03,
		children,
	}: Props = $props()

	// Draw uikit content on top of the scene (real-world depth, selection OBB,
	// etc.), matching the old HUD behavior.
	provideDefaultProperties(() => ({
		depthTest: false,
		renderOrder: 999,
	}))

	const leftController = fromStore(useController('left'))
	const leftWrist = fromStore(useHandJoint('left', 'wrist'))

	// Prefer the hand wrist joint when hand tracking is active; fall back to
	// the controller grip. Both are three.js Groups updated per frame by
	// WebXR, so attaching as a child follows the wrist automatically.
	const parent = $derived(leftWrist.current ?? leftController.current?.grip)

	const group = new Group()
</script>

{#if parent}
	<T
		is={group}
		attach={parent}
		{position}
		{rotation}
		{scale}
	>
		{@render children?.()}
	</T>
{/if}
