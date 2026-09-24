<script lang="ts">
	import WorkspacePortal from '$lib/components/overlay/Portals/WorkspacePortal.svelte'

	import FullscreenButton from './FullscreenButton.svelte'
	import { useFullscreen } from './useFullscreen.svelte'

	const fullscreen = useFullscreen()

	$effect(() => {
		fullscreen.available = true

		return () => {
			fullscreen.available = false
			fullscreen.active = false
		}
	})
</script>

<WorkspacePortal>
	<FullscreenButton bind:fullscreen={fullscreen.active} />
</WorkspacePortal>
