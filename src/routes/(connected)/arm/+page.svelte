<script lang="ts">
	import { useResourceNames } from '@viamrobotics/svelte-sdk'

	import { Arm } from '#lib/plugins/index.js'

	import { useMachineConnection } from '../../lib/hooks/useMachineConnection.svelte'

	const machineConnection = useMachineConnection()
	const arms = useResourceNames(() => machineConnection.partID, 'arm')
	const firstArm = $derived(arms.current[0])
</script>

{#if firstArm}
	<Arm
		partID={machineConnection.partID}
		name={firstArm.name}
	/>
{/if}
