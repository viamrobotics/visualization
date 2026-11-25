<script lang="ts">
	import { useResourceNames } from '@viamrobotics/svelte-sdk'

	import { useCamera } from '#lib'
	import { Arm } from '#lib/plugins/index.js'

	import { useMachineConnection } from '../../lib/hooks/useMachineConnection.svelte'

	const camera = useCamera()
	const machineConnection = useMachineConnection()
	const arms = useResourceNames(() => machineConnection.partID, 'arm')
	const firstArm = $derived(arms.current[0])
</script>

{#if firstArm}
	<Arm
		partID={machineConnection.partID}
		name={firstArm.name}
		display="model"
		refreshRate={200}
		onready={() => {
			console.log('here')
			camera.fit()
		}}
	/>
{/if}
