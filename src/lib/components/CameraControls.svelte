<script lang="ts">
	import { MathUtils } from 'three'
	import { CameraControls, type CameraControlsRef, Gizmo } from '@threlte/extras'
	import { useCameraControls, useTransformControls } from '$lib/hooks/useControls.svelte'
	import KeyboardControls from './KeyboardControls.svelte'
	import Portal from './portal/Portal.svelte'
	import Button from './dashboard/Button.svelte'
	import { useSettings } from '$lib/hooks/useSettings.svelte'

	const cameraControls = useCameraControls()
	const settings = useSettings()
	const transformControls = useTransformControls()

	const enableKeybindings = $derived(settings.current.enableKeybindings)
</script>

<Portal id="dashboard">
	<fieldset>
		<Button
			active
			icon="camera-outline"
			description="Reset camera"
			onclick={() => {
				cameraControls.current?.reset(true)
			}}
		/>
	</fieldset>
</Portal>

<CameraControls
	enabled={!transformControls.active}
	oncreate={(ref) => {
		cameraControls.set(ref)
		;(window as unknown as { MathUtils: typeof MathUtils }).MathUtils = MathUtils
		;(window as unknown as { cameraControls: CameraControlsRef }).cameraControls = ref
	}}
>
	{#snippet children({ ref }: { ref: CameraControlsRef })}
		{#if enableKeybindings}
			<KeyboardControls cameraControls={ref} />
		{/if}
		<Gizmo />
	{/snippet}
</CameraControls>
