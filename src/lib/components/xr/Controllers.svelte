<script lang="ts">
	import { Controller } from '@threlte/xr'
	import { T } from '@threlte/core'
	// import { useGamepad } from '@threlte/extras'

	// import { BaseClient } from '@viamrobotics/sdk'

	import { RigidBody } from '@threlte/rapier'
	import HandCollider from './HandCollider.svelte'
	import ArmTeleop from './ArmTeleop.svelte'
	import { useArmClient } from '$lib/hooks/useArmClient.svelte'
	import { usePartID } from '$lib/hooks/usePartID.svelte'
	import { useResourceNames } from '@viamrobotics/svelte-sdk'
	import { useSettings } from '$lib/hooks/useSettings.svelte'

	const settings = useSettings()
	const armClient = useArmClient()

	const partID = usePartID()
	const resources = useResourceNames(() => partID.current)
	const grippers = $derived(resources.current.filter((r) => r.subtype === 'gripper'))

	// Get controller config from settings
	const config = $derived(settings.current.xrControllerConfig)

	// Left controller configuration
	const leftArmName = $derived(config.left.armName)
	const leftGripperName = $derived(config.left.gripperName)
	const leftScaleFactor = $derived(config.left.scaleFactor)
	const leftRotationEnabled = $derived(config.left.rotationEnabled)

	// Right controller configuration
	const rightArmName = $derived(config.right.armName)
	const rightGripperName = $derived(config.right.gripperName)
	const rightScaleFactor = $derived(config.right.scaleFactor)
	const rightRotationEnabled = $derived(config.right.rotationEnabled)

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

<!-- Left Controller Arm Teleop -->
{#if leftArmName}
	{#key `${leftArmName}-${leftGripperName}-${leftScaleFactor}-${leftRotationEnabled}`}
		<ArmTeleop
			armName={leftArmName}
			gripperName={leftGripperName}
			scaleFactor={leftScaleFactor}
			rotationEnabled={leftRotationEnabled}
			hand="left"
		/>
	{/key}
{/if}

<!-- Right Controller Arm Teleop -->
{#if rightArmName}
	{#key `${rightArmName}-${rightGripperName}-${rightScaleFactor}-${rightRotationEnabled}`}
		<ArmTeleop
			armName={rightArmName}
			gripperName={rightGripperName}
			scaleFactor={rightScaleFactor}
			rotationEnabled={rightRotationEnabled}
			hand="right"
		/>
	{/key}
{/if}
