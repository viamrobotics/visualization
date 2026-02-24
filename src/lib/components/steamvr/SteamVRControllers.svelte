<script lang="ts">
	import { T } from '@threlte/core'
	import { useSettings } from '$lib/hooks/useSettings.svelte'
	import { useSteamVRBridge } from '$lib/hooks/useSteamVRBridge.svelte'
	import SteamVRTeleop from './SteamVRTeleop.svelte'

	const settings = useSettings()
	const bridge = useSteamVRBridge()

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

	const left = $derived(bridge.state.left)
	const right = $derived(bridge.state.right)
</script>

<!-- Left Controller Visualization -->
{#if left.connected}
	<T.Group
		position={left.position.toArray()}
		quaternion={left.rotation.toArray()}
	>
		<T.Mesh>
			<T.BoxGeometry args={[0.04, 0.04, 0.15]} />
			<T.MeshStandardMaterial color="#4488ff" />
		</T.Mesh>
		<T.AxesHelper args={[0.1]} />
	</T.Group>
{/if}

<!-- Right Controller Visualization -->
{#if right.connected}
	<T.Group
		position={right.position.toArray()}
		quaternion={right.rotation.toArray()}
	>
		<T.Mesh>
			<T.BoxGeometry args={[0.04, 0.04, 0.15]} />
			<T.MeshStandardMaterial color="#ff4488" />
		</T.Mesh>
		<T.AxesHelper args={[0.1]} />
	</T.Group>
{/if}

<!-- Left Controller Arm Teleop -->
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

<!-- Right Controller Arm Teleop -->
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
