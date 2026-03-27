<script lang="ts">
	import { RigidBody } from '@threlte/rapier'
	import { Controller } from '@threlte/xr'

	import { useSettings } from '$lib/hooks/useSettings.svelte'

	import ArmTeleop from '../ArmTeleop.svelte'
	import HandCollider from '../HandCollider.svelte'

	const settings = useSettings()

	// Get controller config from settings
	const config = $derived(settings.current.xrController)

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
