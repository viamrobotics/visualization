<script lang="ts">
	import { useSettings } from '$lib/hooks/useSettings.svelte'
	import SteamVRTeleop from './SteamVRTeleop.svelte'

	const settings = useSettings()

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

<!-- Left Controller Arm Teleop (controller renders on end effector when grip pressed) -->
{#if leftArmName}
	{#key `${leftArmName}-${leftGripperName}-${leftScaleFactor}-${leftRotationEnabled}`}
		<SteamVRTeleop
			armName={leftArmName}
			gripperName={leftGripperName}
			scaleFactor={leftScaleFactor}
			rotationEnabled={leftRotationEnabled}
			hand="left"
		/>
	{/key}
{/if}

<!-- Right Controller Arm Teleop (controller renders on end effector when grip pressed) -->
{#if rightArmName}
	{#key `${rightArmName}-${rightGripperName}-${rightScaleFactor}-${rightRotationEnabled}`}
		<SteamVRTeleop
			armName={rightArmName}
			gripperName={rightGripperName}
			scaleFactor={rightScaleFactor}
			rotationEnabled={rightRotationEnabled}
			hand="right"
		/>
	{/key}
{/if}
