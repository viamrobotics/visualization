<!--
@component

Draws one arm live, in its own base frame: the base sits at the world origin, and the links follow
the arm's joint positions. Nothing else on the machine is drawn, including a gripper mounted on the
arm.

Links are posed from `getJointPositions` through the arm's kinematics, the same forward kinematics
the motion previews use. Until the arm reports positions that fit its kinematics, nothing is drawn.

```svelte
<Visualizer>
	<Arm {partID} name="my-arm" />
</Visualizer>
```
-->
<script lang="ts">
	import type { Entity } from 'koota'

	import { ArmClient, MachineConnectionEvent } from '@viamrobotics/sdk'
	import {
		createResourceClient,
		createResourceQuery,
		createRobotQuery,
		useConnectionStatus,
		useRobotClient,
	} from '@viamrobotics/svelte-sdk'
	import { untrack } from 'svelte'

	import type { TrajectoryStep } from '#lib/motion/jointPose.js'

	import ArmModel from '#lib/components/ArmModel.svelte'
	import { traits, useWorld } from '#lib/ecs/index.js'
	import { TRANSLUCENT_GEOMETRY_OPACITY } from '#lib/ecs/opacity.svelte.js'
	import { provide3DModels } from '#lib/hooks/use3DModels.svelte.js'
	import { ownerOfInternalFrame } from '#lib/kinematicsFrames.js'
	import { armInputsFromJointPositions } from '#lib/motion/armInputsFromJointPositions.js'
	import { buildFrameDescriptors } from '#lib/motion/frameDescriptors.js'
	import { frameSystemToPlanFrames } from '#lib/motion/frameSystemToPlanFrames.js'
	import {
		applyInputs,
		descriptorGeometryTraits,
		type PosedJoint,
		spawnPosedFrame,
	} from '#lib/posedFrames.js'

	import { armPartAtOrigin } from './armPartAtOrigin'

	interface Props {
		partID: string
		/** The arm component to draw. */
		name: string
	}

	const { partID, name }: Props = $props()

	/** Matches the live machine's arm polling in `provideArmClient`. */
	const JOINT_POSITIONS_INTERVAL_MS = 500

	provide3DModels(() => partID)

	const world = useWorld()
	const robotClient = useRobotClient(() => partID)
	const connectionStatus = useConnectionStatus(() => partID)
	const isConnected = $derived(connectionStatus.current === MachineConnectionEvent.CONNECTED)

	const frameSystem = createRobotQuery(robotClient, 'frameSystemConfig', () => ({
		refetchOnWindowFocus: false,
		enabled: isConnected,
	}))

	const armClient = createResourceClient(
		ArmClient,
		() => partID,
		() => name
	)

	const jointPositions = createResourceQuery(armClient, 'getJointPositions', {
		refetchInterval: JOINT_POSITIONS_INTERVAL_MS,
	})

	const descriptors = $derived.by(() => {
		const part = armPartAtOrigin(frameSystem.data ?? [], name)
		return part ? buildFrameDescriptors(frameSystemToPlanFrames([part])) : []
	})

	const inputs = $derived.by((): TrajectoryStep | undefined => {
		const positions = jointPositions.data?.values
		if (!positions) return undefined
		const armInputs = armInputsFromJointPositions(descriptors, name, positions)
		return armInputs ? { [name]: armInputs } : undefined
	})

	const hasInputs = $derived(inputs !== undefined)

	let joints: PosedJoint[] = []

	// Respawns only when the kinematics change, or when the arm's pose becomes known or unknown.
	// Drawing the arm before its joints are known would show a pose it is not in.
	$effect(() => {
		if (!hasInputs || descriptors.length === 0) return

		const start = untrack(() => inputs) ?? {}
		const entities: Entity[] = []
		joints = []

		for (const descriptor of descriptors) {
			const isLink = descriptor.kind === 'static' && ownerOfInternalFrame(descriptor.name) === name
			const geometryTraits = descriptorGeometryTraits(descriptor)

			const entity = spawnPosedFrame(world, descriptor, descriptor.name, descriptor.parent, start, [
				traits.ShowAxesHelper,
				...geometryTraits,
				...(geometryTraits.length > 0 ? [traits.Opacity(TRANSLUCENT_GEOMETRY_OPACITY)] : []),
				...(isLink ? [traits.KinematicLink] : []),
			])

			entities.push(entity)
			if (descriptor.kind === 'joint') joints.push({ descriptor, entity })
		}

		return () => {
			for (const entity of entities.toReversed()) {
				if (entity.isAlive()) entity.destroy()
			}
			joints = []
		}
	})

	$effect(() => {
		if (inputs) applyInputs(joints, inputs)
	})
</script>

<ArmModel
	{partID}
	{name}
/>
