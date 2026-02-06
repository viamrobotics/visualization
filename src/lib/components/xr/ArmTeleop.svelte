<script lang="ts">
	import { useTask, T } from '@threlte/core'
	import { useController, useXR } from '@threlte/xr'
	import { Vector3, Quaternion } from 'three'
	import { createResourceClient } from '@viamrobotics/svelte-sdk'
	import { ArmClient, GripperClient } from '@viamrobotics/sdk'
	import { usePartID } from '$lib/hooks/usePartID.svelte'
	import {
		getFrameTransformationQuaternion,
		calculatePositionTarget,
	} from '$lib/utils/vr-math'
	import { OrientationVector } from '$lib/three/OrientationVector'

	interface Props {
		armName: string
		gripperName?: string
		scaleFactor?: number
		hand?: 'left' | 'right'
		rotationEnabled?: boolean
	}

	let { armName, gripperName, scaleFactor = 1.0, hand = 'right', rotationEnabled = true }: Props = $props()

	const partID = usePartID()
	// Create Viam Arm Client
	const armClient = createResourceClient(
		ArmClient,
		() => partID.current,
		() => armName
	)

	// Create Viam Gripper Client (optional)
	const gripperClient = gripperName
		? createResourceClient(
			GripperClient,
			() => partID.current,
			() => gripperName
		)
		: undefined

	// Get XR Context for Raw Input
	const { session } = useXR()
	const controller = useController(hand)

	let isControlling = $state(false)
	let wasPressed = false // Frame-to-frame state for edge detection (squeeze button)
	let wasTriggerPressed = false // Frame-to-frame state for trigger
	let isSending = false
	let gripperStopTimeout: ReturnType<typeof setTimeout> | null = null

	// Reference States
	let controllerRefPos = new Vector3()
	// The Controller's rotation at start, converted to Robot Frame
	let controllerRefRotRobot = new Quaternion()

	// Robot Reference (Viam Checkpoint)
	let robotRefPos = { x: 0, y: 0, z: 0 }
	let robotRefQuat = new Quaternion()
	let robotRefOV = new OrientationVector() // Store original OV

	// Offset from controller orientation to arm orientation
	// This maintains the relationship: armRot = controllerRot * offset
	let controllerToArmOffset = new Quaternion()

	// Transformation Frame
	const qTransform = getFrameTransformationQuaternion()

	// Throttling
	let lastCommandTime = 0
	let errorTimeout = 0
	const COMMAND_INTERVAL = 100 // ms (10Hz)
	const ERROR_COOLDOWN = 1000 // ms

	// Rotation Deadband - matches Dart implementation
	const ROTATION_DEADBAND_RAD = 0.25 // ~14.3 degrees

	// Ghost Visualization State
	let ghostPos = new Vector3()
	let ghostRot = new Quaternion()
	let ghostPosArray = $state<[number, number, number]>([0, 0, 0])
	let ghostRotArray = $state<[number, number, number, number]>([0, 0, 0, 1])

	useTask(() => {
		// 1. Get Input Source
		const currentSession = $session
		if (!currentSession || !controller.current) return

		const inputSource = Array.from(currentSession.inputSources).find((s) => s.handedness === hand)

		if (!inputSource || !inputSource.gamepad) return

		// 2. Poll Buttons
		// Trigger (button 0) - Gripper control
		// Squeeze/Grip (button 1) - Arm control
		const trigger = inputSource.gamepad.buttons[0]
		const squeeze = inputSource.gamepad.buttons[1]
		const isPressed = squeeze && squeeze.pressed
		const isTriggerPressed = trigger && trigger.pressed

		// 3. Edge Detection & State Machine - ARM CONTROL (Squeeze)
		if (isPressed && !wasPressed) {
			// Rising Edge: Start Control
			if (armClient.current) {
				handleStartControl(controller.current)
			}
		} else if (!isPressed && wasPressed) {
			// Falling Edge: Stop Control
			if (isControlling) {
				console.log('[ArmTeleop] Button Released. Stopping.')
				isControlling = false
			}
		}

		// 4. Edge Detection - GRIPPER CONTROL (Trigger)
		if (gripperClient?.current) {
			if (isTriggerPressed && !wasTriggerPressed) {
				// Trigger pressed: Grab/close gripper, then stop after 0.5s
				// Clear any pending stop timeout
				if (gripperStopTimeout) {
					clearTimeout(gripperStopTimeout)
					gripperStopTimeout = null
				}
				console.log('[ArmTeleop] Trigger pressed - Closing gripper')
				gripperClient.current.grab().catch((e) => console.warn('Gripper grab failed:', e))

				// Schedule stop after 1 second
				gripperStopTimeout = setTimeout(() => {
					console.log('[ArmTeleop] Stopping gripper after 1s')
					gripperClient?.current?.stop().catch((e) => console.warn('Gripper stop failed:', e))
					gripperStopTimeout = null
				}, 1000)
			} else if (!isTriggerPressed && wasTriggerPressed) {
				// Trigger released: Open gripper, then stop after 0.5s
				// Clear any pending stop timeout
				if (gripperStopTimeout) {
					clearTimeout(gripperStopTimeout)
					gripperStopTimeout = null
				}
				console.log('[ArmTeleop] Trigger released - Opening gripper')
				gripperClient.current.open().catch((e) => console.warn('Gripper open failed:', e))

				// Schedule stop after 1 second
				gripperStopTimeout = setTimeout(() => {
					console.log('[ArmTeleop] Stopping gripper after 1s')
					gripperClient?.current?.stop().catch((e) => console.warn('Gripper stop failed:', e))
					gripperStopTimeout = null
				}, 1000)
			}
		}

		wasPressed = isPressed
		wasTriggerPressed = isTriggerPressed

		// 4. Control Loop
		if (isControlling && armClient.current) {
			handleControlFrame(controller.current)
		}
	})

	// Helper to transform VR Quaternion to Robot Frame: T * q * inv(T)
	function transformToRobotFrame(q: Quaternion, transform: Quaternion) {
		const transformInv = transform.clone().invert()
		return transform.clone().multiply(q).multiply(transformInv)
	}

	async function handleStartControl(c: any) {
		console.log('[ArmTeleop] Input Start')
		try {
			const currentPose = await armClient.current!.getEndPosition()
			console.log('[ArmTeleop] ========================================')
			console.log('[ArmTeleop] TELEOP SESSION STARTED')
			console.log('[ArmTeleop] Current Arm End Effector Position:')
			console.log('[ArmTeleop]   Position (mm): ' + JSON.stringify({ x: currentPose.x, y: currentPose.y, z: currentPose.z }))
			console.log('[ArmTeleop]   Orientation: ' + JSON.stringify({ oX: currentPose.oX, oY: currentPose.oY, oZ: currentPose.oZ, theta: currentPose.theta }))
			console.log('[ArmTeleop] ========================================')

			if (!currentPose) {
				console.warn('[ArmTeleop] Could not get end position')
				return
			}

			const { x, y, z, oX, oY, oZ, theta } = currentPose

			robotRefPos = { x, y, z }
			robotRefOV.set(oX, oY, oZ, theta) // Store original orientation vector
			robotRefQuat = robotRefOV.toQuaternion(new Quaternion()).normalize()

			// Use grip space for tracking
			const grip = c.grip
			if (!grip) {
				console.error('[ArmTeleop] No grip space found on controller')
				return
			}

			controllerRefPos.copy(grip.position)
			console.log('[ArmTeleop] Controller Reference Position (m): ' + JSON.stringify({
				x: controllerRefPos.x,
				y: controllerRefPos.y,
				z: controllerRefPos.z
			}))

			// 1. Capture Reference and Transform to Robot Frame straight away
			// Matches Dart: referenceRotationQuaternionViamPhone
			controllerRefRotRobot = transformToRobotFrame(grip.quaternion, qTransform).normalize()
			console.log('[ArmTeleop] Controller Reference Rotation (robot frame): ' + JSON.stringify({
				x: controllerRefRotRobot.x,
				y: controllerRefRotRobot.y,
				z: controllerRefRotRobot.z,
				w: controllerRefRotRobot.w
			}))

			// 2. Compute offset from controller orientation to arm orientation
			// This maintains: armRot = controllerRot * offset
			// So: offset = inverse(controllerRot) * armRot
			controllerToArmOffset = controllerRefRotRobot.clone().invert().multiply(robotRefQuat).normalize()
			console.log('[ArmTeleop] Controller→Arm Offset Quaternion: ' + JSON.stringify({
				x: controllerToArmOffset.x,
				y: controllerToArmOffset.y,
				z: controllerToArmOffset.z,
				w: controllerToArmOffset.w
			}))

			errorTimeout = 0

			isControlling = true
			console.log('[ArmTeleop] Teleop Engaged - Absolute rotation with offset')
		} catch (e) {
			console.error('Failed to start teleop:', e)
		}
	}

	function handleControlFrame(c: any) {
		const now = Date.now()

		const grip = c.grip
		if (!grip) return

		const currentControllerPos = grip.position
		const currentControllerRot = grip.quaternion

		// Calculate Delta VR for visualizer
		const deltaVR = currentControllerPos.clone().sub(controllerRefPos)

		// --- Position Step ---
		const targetPos = calculatePositionTarget(
			currentControllerPos,
			controllerRefPos,
			robotRefPos,
			qTransform,
			scaleFactor
		)

		// --- Rotation Step ---
		let targetOV
		if (rotationEnabled) {
			// ABSOLUTE ROTATION: Transform controller orientation to robot frame, then apply offset
			// 1. Transform VR Frame → Robot Frame using sandwich transform: T * q * T^-1
			const currentRotRobot = transformToRobotFrame(currentControllerRot, qTransform).normalize()

			// 2. Apply offset to maintain initial controller→arm relationship
			// targetArmRot = currentControllerRot * offset
			const targetArmRotQuat = currentRotRobot.clone().multiply(controllerToArmOffset).normalize()

			// 3. Convert to Viam OrientationVector using proper Dart-matching algorithm
			targetOV = new OrientationVector().setFromQuaternion(targetArmRotQuat)
			console.log('[ArmTeleop]   Using ABSOLUTE rotation with offset')

			// Update Ghost Rotation for visualizer
			ghostRot.copy(currentControllerRot)
		} else {
			// Keep orientation fixed to start - use original OV
			targetOV = robotRefOV
			ghostRot.copy(grip.quaternion) // Just track hand
		}

		// --- Update Ghost Visualizer ---
		ghostPos.copy(controllerRefPos).add(deltaVR.multiplyScalar(scaleFactor))

		/* 
		   Ghost Rotation is handled above for simplicity.
		   Strictly, visualizer should probably show the Robot Frame rotation mapped back to VR,
		   but showing raw controller rotation is better for "feeling" where your hand is.
		*/

		ghostPosArray = ghostPos.toArray()
		ghostRotArray = ghostRot.toArray()

		// --- Send Command ---
		if (now - lastCommandTime < COMMAND_INTERVAL) return
		if (isSending) return
		if (now < errorTimeout) return

		lastCommandTime = now
		isSending = true

		if (isNaN(targetPos.x) || isNaN(targetOV.th)) {
			console.warn('Teleop Safety: NaN detected', targetPos, targetOV)
			isSending = false
			return
		}

		// Enhanced logging: show reference, current controller state, and target
		console.log('[ArmTeleop] ========================================')
		console.log('[ArmTeleop] Frame Update:')
		console.log('[ArmTeleop]   Controller Delta (m): ' + JSON.stringify({
			x: (currentControllerPos.x - controllerRefPos.x).toFixed(4),
			y: (currentControllerPos.y - controllerRefPos.y).toFixed(4),
			z: (currentControllerPos.z - controllerRefPos.z).toFixed(4)
		}))
		console.log('[ArmTeleop]   Robot Reference Pos (mm): ' + JSON.stringify(robotRefPos))
		console.log('[ArmTeleop]   Target Pos (mm): ' + JSON.stringify({
			x: targetPos.x.toFixed(2),
			y: targetPos.y.toFixed(2),
			z: targetPos.z.toFixed(2)
		}))
		console.log('[ArmTeleop]   Position Delta (mm): ' + JSON.stringify({
			x: (targetPos.x - robotRefPos.x).toFixed(2),
			y: (targetPos.y - robotRefPos.y).toFixed(2),
			z: (targetPos.z - robotRefPos.z).toFixed(2)
		}))
		console.log('[ArmTeleop]   Reference Orientation: ' + JSON.stringify({
			ox: robotRefOV.x.toFixed(4),
			oy: robotRefOV.y.toFixed(4),
			oz: robotRefOV.z.toFixed(4),
			theta: robotRefOV.th.toFixed(4)
		}))
		console.log('[ArmTeleop]   Target Orientation: ' + JSON.stringify({
			ox: targetOV.x.toFixed(4),
			oy: targetOV.y.toFixed(4),
			oz: targetOV.z.toFixed(4),
			theta: targetOV.th.toFixed(4)
		}))
		console.log('[ArmTeleop] ========================================')

		armClient
			.current!.moveToPosition({
				x: targetPos.x,
				y: targetPos.y,
				z: targetPos.z,
				oX: targetOV.x,
				oY: targetOV.y,
				oZ: targetOV.z,
				theta: targetOV.th,
			})
			.catch((e) => {
				console.warn('Move failed:', e)
				errorTimeout = Date.now() + ERROR_COOLDOWN
			})
			.finally(() => {
				isSending = false
			})
	}
</script>

{#if isControlling}
	<!-- Ghost Marker (Target Position in VR Space) -->
	<T.Mesh
		position={ghostPosArray}
		quaternion={ghostRotArray}
	>
		<T.BoxGeometry args={[0.05, 0.05, 0.1]} />
		<T.MeshBasicMaterial
			color="hotpink"
			wireframe
		/>
		<T.AxesHelper args={[0.2]} />
	</T.Mesh>

	<!-- Original Reference Marker -->
	<T.Mesh position={controllerRefPos.toArray()}>
		<T.SphereGeometry args={[0.02]} />
		<T.MeshBasicMaterial
			color="gray"
			opacity={0.5}
			transparent
		/>
	</T.Mesh>
{/if}
