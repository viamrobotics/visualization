<script lang="ts">
	import { Controller } from '@threlte/xr'
	// import { useGamepad } from '@threlte/extras'

	// import { BaseClient } from '@viamrobotics/sdk'

	import { RigidBody } from '@threlte/rapier'
	import HandCollider from './HandCollider.svelte'
	import ArmTeleop from './ArmTeleop.svelte'
	import { useArmClient } from '$lib/hooks/useArmClient.svelte'
	import { usePartID } from '$lib/hooks/usePartID.svelte'
	import { useResourceNames } from '@viamrobotics/svelte-sdk'

	const armClient = useArmClient()
	const armName = $derived(armClient?.names[0])

	const partID = usePartID()
	const resources = useResourceNames(() => partID.current)
	const gripperResource = $derived(resources.current.find((r) => r.subtype === 'gripper'))
	const gripperName = $derived(gripperResource?.name)

	// const gamepadLeft = useGamepad({ xr: true, hand: 'left' })

	// const partID = usePartID()
	// const resources = useResourceNames(() => partID.current)
	// const robotClient = useRobotClient(() => partID.current)
	// const resource = $derived(resources.current.find((r) => r.subtype === 'base'))
	// const baseClient = $derived(
	// 	robotClient.current && resource ? new BaseClient(robotClient.current, resource.name) : undefined
	// )

	// const linear = { x: 0, y: 0, z: 0 }
	// const angular = { x: 0, y: 0, z: 0 }

	// gamepadLeft.squeeze.on('change', (event) => {
	// 	linear.y = -event.value
	// 	baseClient?.setPower(linear, angular)
	// })

	// gamepadLeft.trigger.on('change', (event) => {
	// 	if (typeof event.value === 'number') {
	// 		linear.y = event.value
	// 		baseClient?.setPower(linear, angular)
	// 	}
	// })

	// gamepadLeft.thumbstick.on('change', (event) => {
	// 	if (typeof event.value === 'object') {
	// 		angular.z = event.value.x
	// 		baseClient?.setPower(linear, angular)
	// 	}
	// })
</script>

<Controller left>
	{#snippet grip()}
		<RigidBody type="kinematicPosition">
			<HandCollider />
		</RigidBody>
	{/snippet}
</Controller>

<Controller right>
	{#snippet grip()}
		<RigidBody type="kinematicPosition">
			<HandCollider />
		</RigidBody>
	{/snippet}
</Controller>

{#if armName}
	<ArmTeleop
		{armName}
		{gripperName}
		hand="right"
	/>
{/if}
