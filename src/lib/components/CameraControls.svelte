<script lang="ts">
	import { CameraControls, type CameraControlsRef, Gizmo } from '@threlte/extras'
	import { MathUtils } from 'three'

	import { useCameraControls, useTransformControls } from '$lib/hooks/useControls.svelte'
	import { useEnvironment } from '$lib/hooks/useEnvironment.svelte'
	import { useSettings } from '$lib/hooks/useSettings.svelte'

	import InputBindings from './InputBindings.svelte'

	const cameraControls = useCameraControls()
	const environment = useEnvironment()
	const settings = useSettings()
	const transformControls = useTransformControls()

	const inputBindingsEnabled = $derived(environment.current.inputBindingsEnabled)
</script>

<CameraControls
	smoothTime={settings.current.cameraSmoothTime}
	draggingSmoothTime={settings.current.cameraDraggingSmoothTime}
	dollyToCursor={settings.current.enableDollyToCursor}
	enabled={!transformControls.active}
	oncreate={(ref) => {
		cameraControls.set(ref)
		;(globalThis as unknown as { MathUtils: typeof MathUtils }).MathUtils = MathUtils
		;(globalThis as unknown as { cameraControls: CameraControlsRef }).cameraControls = ref
	}}
>
	{#snippet children({ ref }: { ref: CameraControlsRef })}
		{#if inputBindingsEnabled}
			<InputBindings cameraControls={ref} />
		{/if}
		<Gizmo placement="bottom-right" />
	{/snippet}
</CameraControls>
