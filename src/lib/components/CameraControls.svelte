<script lang="ts">
	import { CameraControls, type CameraControlsRef, Gizmo, Portal } from '@threlte/extras'
	import { MathUtils } from 'three'

	import Button from '$lib/components/overlay/dashboard/Button.svelte'
	import { useCameraControls, useTransformControls } from '$lib/hooks/useControls.svelte'
	import { useEnvironment } from '$lib/hooks/useEnvironment.svelte'

	import InputBindings from './InputBindings.svelte'

	const cameraControls = useCameraControls()
	const environment = useEnvironment()
	const transformControls = useTransformControls()

	const inputBindingsEnabled = $derived(environment.current.inputBindingsEnabled)
</script>

<Portal id="dashboard">
	<fieldset>
		<Button
			active
			icon="camera-outline"
			description="Reset camera"
			onclick={() => {
				cameraControls.setInitialPose()
			}}
		/>
	</fieldset>
</Portal>

<CameraControls
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
