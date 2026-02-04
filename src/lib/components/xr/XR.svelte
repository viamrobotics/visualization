<script lang="ts">
	import { T } from '@threlte/core'
	import { useXR, XR, XRButton } from '@threlte/xr'
	import { World } from '@threlte/rapier'
	import OriginMarker from './OriginMarker.svelte'
	import { useSettings } from '$lib/hooks/useSettings.svelte'
	import Controllers from './Controllers.svelte'

	const { ...rest } = $props()

	const { isPresenting } = useXR()
	const settings = useSettings()
	const enableXR = $derived(settings.current.enableXR)
</script>

{#if enableXR || true}
	<XR>
		<World>
			<Controllers />

			<T.Group position.z={-2}>
				<T.Group rotation.x={$isPresenting ? -Math.PI / 2 : 0}>
					<OriginMarker />
				</T.Group>
			</T.Group>
		</World>
	</XR>

	<XRButton
		mode="immersive-ar"
		{...rest}
	/>
{/if}
