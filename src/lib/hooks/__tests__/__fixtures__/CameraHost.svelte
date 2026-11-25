<script lang="ts">
	import type { CameraControlsRef } from '@threlte/extras/webgpu'

	import { provideCameraControls, useCameraControls } from '#lib/hooks/useControls.svelte.js'

	import { useCamera } from '../../useCamera'

	interface Props {
		controls: CameraControlsRef
		oncamera: (camera: ReturnType<typeof useCamera>) => void
	}

	const { controls, oncamera }: Props = $props()

	provideCameraControls(() => undefined)
	useCameraControls().set(controls)
	oncamera(useCamera())
</script>
