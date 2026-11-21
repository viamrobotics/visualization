<script lang="ts">
	import type { Snippet } from 'svelte'

	import { Canvas } from '@threlte/core/webgpu'
	import { NeutralToneMapping } from 'three'
	import { WebGPURenderer } from 'three/webgpu'

	import HoveredEntities from './hover/HoveredEntities.svelte'
	import Scene from './Scene.svelte'
	import SceneProviders from './SceneProviders.svelte'

	interface Props {
		/** Three.js children, rendered inside the scene. */
		children?: Snippet

		/** Rendered after the scene, inside the Threlte and scene-provider contexts. */
		overlays?: Snippet
	}

	let { children, overlays }: Props = $props()
</script>

<Canvas
	renderMode="on-demand"
	toneMapping={NeutralToneMapping}
	createRenderer={(canvas) =>
		new WebGPURenderer({
			canvas,
			antialias: true,
			// Keeps depth precision near-uniform, so nearby surfaces don't z-fight when zoomed out.
			reversedDepthBuffer: true,
		})}
>
	<SceneProviders>
		<Scene>
			{@render children?.()}
		</Scene>

		<HoveredEntities />

		{@render overlays?.()}
	</SceneProviders>
</Canvas>
