<script lang="ts">
	import { T, useThrelte } from '@threlte/core'
	import { useSettings } from '$lib/hooks/useSettings.svelte'
	import type { Camera } from 'three'

	let { children, ...rest } = $props()

	const { camera } = useThrelte()
	const settings = useSettings()
	const mode = $derived(settings.current.cameraMode)

	$effect(() => {
		;(window as unknown as { camera: Camera }).camera = $camera
	})
</script>

{#if mode === 'perspective'}
	<T.PerspectiveCamera
		makeDefault
		near={0.01}
		up={[0, 0, 1]}
		oncreate={(ref) => {
			ref.lookAt(0, 0, 0)
		}}
		{...rest}
	>
		{@render children?.()}
	</T.PerspectiveCamera>
{:else if mode === 'orthographic'}
	<T.OrthographicCamera
		makeDefault
		near={-100}
		far={100}
		zoom={200}
		up={[0, 0, 1]}
		oncreate={(ref) => {
			ref.lookAt(0, 0, 0)
		}}
		{...rest}
	>
		{@render children?.()}
	</T.OrthographicCamera>
{/if}
