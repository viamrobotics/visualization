<script lang="ts">
	import { CameraControls, type CameraControlsRef, Gizmo } from '@threlte/extras'
	import { useTransformControls } from '$lib/hooks/useControls.svelte'
	import KeyboardControls from './KeyboardControls.svelte'
	import Portal from './portal/Portal.svelte'
	import Button from './dashboard/Button.svelte'
	import { useDrawAPI } from '$lib/hooks/useDrawAPI.svelte'

	const drawAPI = useDrawAPI()
	const transformControls = useTransformControls()

	let ref = $state.raw<CameraControlsRef>()

	$effect(() => {
		if (drawAPI.camera) {
			const { position, lookAt, animate } = drawAPI.camera
			ref?.setPosition(position.x, position.y, position.z, animate)
			ref?.setLookAt(position.x, position.y, position.z, lookAt.x, lookAt.y, lookAt.z, animate)
			drawAPI.clearCamera()
		}
	})

	$effect(() => {
		if (ref) {
			;(window as unknown as { cameraControls: CameraControlsRef }).cameraControls = ref
		}
	})
</script>

<Portal id="dashboard">
	<fieldset>
		<Button
			active
			icon="camera-outline"
			description="Reset camera"
			onclick={() => {
				ref?.reset(true)
			}}
		/>
	</fieldset>
</Portal>

<CameraControls
	bind:ref
	enabled={!transformControls.active}
>
	{#snippet children({ ref }: { ref: CameraControlsRef })}
		<KeyboardControls cameraControls={ref} />
		<Gizmo />
	{/snippet}
</CameraControls>
