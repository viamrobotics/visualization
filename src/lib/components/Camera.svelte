<script lang="ts">
	import { T } from '@threlte/core'
	import { useSettings } from '$lib/hooks/useSettings.svelte'

	let { children, ...rest } = $props()

	const settings = useSettings()
	const mode = $derived(settings.current.cameraMode)
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
