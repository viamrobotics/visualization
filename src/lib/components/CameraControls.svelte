<script lang="ts">
	import { CameraControls, type CameraControlsRef, Gizmo } from '@threlte/extras'
	import { useTransformControls } from '$lib/hooks/useControls.svelte'
	import KeyboardControls from './KeyboardControls.svelte'
	import Portal from './portal/Portal.svelte'
	import Button from './dashboard/Button.svelte'
	import { useDrawAPI } from '$lib/hooks/useDrawAPI.svelte'
	import { useThrelte } from '@threlte/core'

	const { camera } = useThrelte()
	const drawAPI = useDrawAPI()
	const transformControls = useTransformControls()

	let ref = $state.raw<CameraControlsRef>()

	$effect(() => {
		if (drawAPI.camera) {
			const { position, lookAt, quaternion, animate } = drawAPI.camera
			ref?.setPosition(position.x, position.y, position.z, animate)

			if (lookAt) {
				ref?.setLookAt(position.x, position.y, position.z, lookAt.x, lookAt.y, lookAt.z, animate)
			}

			if (quaternion && ref) {
				ref.enabled = false
				camera.current.quaternion.copy(quaternion)
			}

			drawAPI.clearCamera()
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
