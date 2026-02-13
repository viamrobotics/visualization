<script lang="ts">
	import { useTask, T } from '@threlte/core'
	import { useController, useXR, type XRController } from '@threlte/xr'
	import { Vector3, Quaternion } from 'three'
	import { createResourceClient } from '@viamrobotics/svelte-sdk'
	import { ArmClient, GripperClient } from '@viamrobotics/sdk'
	import * as VIAM from '@viamrobotics/sdk'
	import { usePartID } from '$lib/hooks/usePartID.svelte'
	import {
		getFrameTransformationQuaternion,
		calculatePositionTarget,
	} from '$lib/components/xr/math'
	import { OrientationVector } from '$lib/three/OrientationVector'
	import { xrToast } from '$lib/components/xr/toasts.svelte'

	interface Props {
		armName: string
		gripperName?: string
		scaleFactor?: number
		hand?: 'left' | 'right'
		rotationEnabled?: boolean
	}

	let {
		armName,
		gripperName,
		scaleFactor = 1.0,
		hand = 'right',
		rotationEnabled = true,
	}: Props = $props()

	const partID = usePartID()

	// Capture initial prop values — parent uses {#key} to force remount on changes.
	// Wrapped in an IIFE to avoid Svelte's state_referenced_locally warning.
	const { initialHand, initialGripperName } = (() => ({
		initialHand: hand,
		initialGripperName: gripperName,
	}))()

	// Create Viam Arm Client
	const armClient = createResourceClient(
		ArmClient,
		() => partID.current,
		() => armName
	)

	// Create Viam Gripper Client (optional)
	const gripperClient = initialGripperName
		? createResourceClient(
				GripperClient,
				() => partID.current,
				() => initialGripperName
			)
		: undefined

	// Get XR Context for Raw Input
	const { session } = useXR()
	const controller = useController(initialHand)

	let isControlling = $state(false)
	let wasPressed = false // Frame-to-frame state for edge detection (squeeze button)
	let wasTriggerPressed = false // Frame-to-frame state for trigger
	let wasBPressed = false // Frame-to-frame state for B button
	let isSending = false
	let isReturning = false // Prevent control during return to saved pose
	let gripperStopTimeout: ReturnType<typeof setTimeout> | null = null

	// Stack to store saved poses - can return to previous positions
	let poseStack: VIAM.Pose[] = []

	// Reference States
	let controllerRefPos = new Vector3()
	// The Controller's rotation at start, converted to Robot Frame
	let controllerRefRotRobot = new Quaternion()

	// Robot Reference (Viam Checkpoint)
	let robotRefPos = { x: 0, y: 0, z: 0 }
	let robotRefQuat = new Quaternion()
	let robotRefOV = new OrientationVector() // Keep default radians - setUnits breaks toQuaternion!

	// Offset from controller orientation to arm orientation
	// This maintains the relationship: armRot = controllerRot * offset
	let controllerToArmOffset = new Quaternion()

	// Transformation Frame
	const qTransform = getFrameTransformationQuaternion()

	// Throttling
	let lastCommandTime = 0
	let errorTimeout = 0
	let lastErrorHapticTime = 0
	const COMMAND_INTERVAL = 11 // ms (90Hz)
	const ERROR_COOLDOWN = 1000 // ms
	const ERROR_HAPTIC_INTERVAL = 200 // ms between error haptic pulses
	let lastErrorToastTime = 0
	const ERROR_TOAST_COOLDOWN = 3000 // ms - don't spam error toasts

	// Haptic Feedback Helper
	function triggerHapticFeedback(intensity: number = 0.5, duration: number = 100) {
		const currentSession = $session
		if (!currentSession) return

		const inputSource = Array.from(currentSession.inputSources).find(
			(s) => s.handedness === initialHand
		)
		if (!inputSource?.gamepad?.hapticActuators?.length) return

		const actuator = inputSource.gamepad.hapticActuators[0]
		if ('pulse' in actuator) {
			actuator
				.pulse(intensity, duration)
				.catch((e) => console.warn('[ArmTeleop] Haptic pulse failed:', e))
		}
	}

	function showArmErrorToast(error: unknown) {
		const now = Date.now()
		if (now - lastErrorToastTime < ERROR_TOAST_COOLDOWN) return
		lastErrorToastTime = now

		const msg = String(error).toLowerCase()
		if (
			msg.includes('motion') &&
			(msg.includes('not found') ||
				msg.includes('not registered') ||
				msg.includes('not configured'))
		) {
			xrToast.danger('Motion service not registered')
		} else {
			xrToast.warning('Position not reachable (IK error)')
		}
	}

	// Ghost Visualization State
	let ghostPos = new Vector3()
	let ghostRot = new Quaternion()
	let ghostPosArray = $state<[number, number, number]>([0, 0, 0])
	let ghostRotArray = $state<[number, number, number, number]>([0, 0, 0, 1])

	useTask(() => {
		// 1. Get Input Source
		const currentSession = $session
		if (!currentSession || !controller.current) return

		const inputSource = Array.from(currentSession.inputSources).find(
			(s) => s.handedness === initialHand
		)

		if (!inputSource || !inputSource.gamepad) return

		// 2. Poll Buttons
		// Trigger (button 0) - Gripper control
		// Squeeze/Grip (button 1) - Arm control
		// B button (button 5 on Quest controllers) - Return to saved pose
		const trigger = inputSource.gamepad.buttons[0]
		const squeeze = inputSource.gamepad.buttons[1]
		const bButton = inputSource.gamepad.buttons[5]
		const isPressed = squeeze && squeeze.pressed
		const isTriggerPressed = trigger && trigger.pressed
		const isBPressed = bButton && bButton.pressed

		// 3. Edge Detection & State Machine - ARM CONTROL (Squeeze)
		if (isPressed && !wasPressed) {
			// Rising Edge: Start Control
			if (armClient.current) {
				handleStartControl(controller.current)
			}
		} else if (!isPressed && wasPressed) {
			// Falling Edge: Stop Control
			if (isControlling) {
				isControlling = false
				// Haptic feedback: short pulse on teleop end
				triggerHapticFeedback(0.3, 80)
				// Log final position
				handleStopControl()
			}
		}

		// 4. Edge Detection - GRIPPER CONTROL (Trigger)
		if (gripperClient?.current) {
			if (isTriggerPressed && !wasTriggerPressed) {
				// Trigger pressed: Grab/close gripper
				// Clear any pending stop timeout
				if (gripperStopTimeout) {
					clearTimeout(gripperStopTimeout)
					gripperStopTimeout = null
				}
				gripperClient.current.grab().catch((e) => console.warn('Gripper grab failed:', e))
			} else if (!isTriggerPressed && wasTriggerPressed) {
				// Trigger released: Open gripper, then stop after 1 second
				// Clear any pending stop timeout
				if (gripperStopTimeout) {
					clearTimeout(gripperStopTimeout)
					gripperStopTimeout = null
				}
				gripperClient.current.open().catch((e) => console.warn('Gripper open failed:', e))

				// Schedule stop after 1 second
				gripperStopTimeout = setTimeout(() => {
					gripperClient?.current?.stop().catch((e) => console.warn('Gripper stop failed:', e))
					gripperStopTimeout = null
				}, 1000)
			}
		}

		// 5. Edge Detection - RETURN TO SAVED POSE (B Button)
		if (isBPressed && !wasBPressed) {
			if (poseStack.length > 0) {
				handleReturnToPose()
			} else {
				xrToast.warning('No saved positions to return to')
			}
		}

		wasPressed = isPressed
		wasTriggerPressed = isTriggerPressed
		wasBPressed = isBPressed

		// 6. Control Loop (skip if returning to saved pose)
		if (isControlling && armClient.current && !isReturning) {
			handleControlFrame(controller.current)
		}
	})

	// Helper to transform XR Quaternion to Robot Frame: T * q * inv(T)
	function transformToRobotFrame(q: Quaternion, transform: Quaternion) {
		const transformInv = transform.clone().invert()
		return transform.clone().multiply(q).multiply(transformInv)
	}

	async function handleStartControl(c: XRController) {
		try {
			const currentPose = await armClient.current!.getEndPosition()

			if (!currentPose) {
				console.warn('[ArmTeleop] Could not get end position')
				return
			}

			const { x, y, z, oX, oY, oZ, theta } = currentPose

			robotRefPos = { x, y, z }
			robotRefOV.set(oX, oY, oZ, (theta * Math.PI) / 180) // SDK returns degrees, convert to radians
			robotRefQuat = robotRefOV.toQuaternion(new Quaternion()).normalize()

			// Save this pose to the stack for quick return
			poseStack.push({ x, y, z, oX, oY, oZ, theta })

			// Use grip space for tracking
			const grip = c.grip
			if (!grip) {
				console.error('[ArmTeleop] No grip space found on controller')
				return
			}

			controllerRefPos.copy(grip.position)

			// 1. Capture Reference and Transform to Robot Frame straight away
			// Matches Dart: referenceRotationQuaternionViamPhone
			controllerRefRotRobot = transformToRobotFrame(grip.quaternion, qTransform).normalize()

			// 2. Compute offset from controller orientation to arm orientation
			// This maintains: armRot = controllerRot * offset
			// So: offset = inverse(controllerRot) * armRot
			controllerToArmOffset = controllerRefRotRobot
				.clone()
				.invert()
				.multiply(robotRefQuat)
				.normalize()

			errorTimeout = 0

			isControlling = true

			// Haptic feedback: short pulse on teleop start
			triggerHapticFeedback(0.5, 100)
		} catch (e) {
			console.error('[ArmTeleop] Failed to start teleop:', e)
		}
	}

	async function handleStopControl() {
		try {
			await armClient.current!.getEndPosition()
		} catch (e) {
			console.error('[ArmTeleop] Failed to get final position:', e)
		}
	}

	function handleControlFrame(c: XRController) {
		const now = Date.now()

		const grip = c.grip
		if (!grip) return

		const currentControllerPos = grip.position
		const currentControllerRot = grip.quaternion

		// Calculate Delta XR for visualizer
		const deltaXR = currentControllerPos.clone().sub(controllerRefPos)

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
			// 1. Transform XR Frame → Robot Frame using sandwich transform: T * q * T^-1
			const currentRotRobot = transformToRobotFrame(currentControllerRot, qTransform).normalize()

			// 2. Apply offset to maintain initial controller→arm relationship
			// targetArmRot = currentControllerRot * offset
			const targetArmRotQuat = currentRotRobot.clone().multiply(controllerToArmOffset).normalize()

			// 3. Convert to Viam OrientationVector using proper Dart-matching algorithm
			// Keep radians - conversion to degrees happens when sending to backend
			targetOV = new OrientationVector().setFromQuaternion(targetArmRotQuat)

			// Update Ghost Rotation for visualizer
			ghostRot.copy(currentControllerRot)
		} else {
			// Keep orientation fixed to start - use original OV
			targetOV = robotRefOV
			ghostRot.copy(grip.quaternion) // Just track hand
		}

		// --- Update Ghost Visualizer ---
		ghostPos.copy(controllerRefPos).add(deltaXR.multiplyScalar(scaleFactor))

		/* 
		   Ghost Rotation is handled above for simplicity.
		   Strictly, visualizer should probably show the Robot Frame rotation mapped back to XR,
		   but showing raw controller rotation is better for "feeling" where your hand is.
		*/

		ghostPosArray = ghostPos.toArray()
		ghostRotArray = ghostRot.toArray()

		// --- Send Command ---
		if (now - lastCommandTime < COMMAND_INTERVAL) return
		if (isSending) return

		// If in error state, provide haptic feedback and skip sending
		if (now < errorTimeout) {
			// Buzz controller to indicate IK constraint error (throttled)
			if (now - lastErrorHapticTime > ERROR_HAPTIC_INTERVAL) {
				triggerHapticFeedback(0.7, 150) // Stronger, longer pulse for errors
				lastErrorHapticTime = now
			}
			return
		}

		lastCommandTime = now
		isSending = true

		if (isNaN(targetPos.x) || isNaN(targetOV.th)) {
			console.warn('Teleop Safety: NaN detected', targetPos, targetOV)
			isSending = false
			return
		}

		const command = {
			servo_cartesian: {
				x: targetPos.x,
				y: targetPos.y,
				z: targetPos.z,
				o_x: targetOV.x,
				o_y: targetOV.y,
				o_z: targetOV.z,
				theta: (targetOV.th * 180) / Math.PI, // Convert radians to degrees for backend
				speed: 7,
				acceleration: 10,
			},
		}

		let USE_UFACTORY_IK = false
		if (USE_UFACTORY_IK) {
			const client = armClient.current
			if (client) {
				client
					.doCommand(VIAM.Struct.fromJson(command))
					.catch((e) => {
						console.warn('Move failed:', e)
						errorTimeout = Date.now() + ERROR_COOLDOWN
						triggerHapticFeedback(0.8, 200)
						lastErrorHapticTime = Date.now()
						showArmErrorToast(e)
					})
					.finally(() => {
						isSending = false
					})
			}
		} else {
			armClient
				.current!.moveToPosition({
					x: targetPos.x,
					y: targetPos.y,
					z: targetPos.z,
					oX: targetOV.x,
					oY: targetOV.y,
					oZ: targetOV.z,
					theta: (targetOV.th * 180) / Math.PI,
				})
				.catch((e) => {
					console.warn('Move failed:', e)
					errorTimeout = Date.now() + ERROR_COOLDOWN
					triggerHapticFeedback(0.8, 200)
					lastErrorHapticTime = Date.now()
					showArmErrorToast(e)
				})
				.finally(() => {
					isSending = false
				})
		}
	}

	async function handleReturnToPose() {
		if (!armClient.current || poseStack.length === 0) return

		// Pop the last saved pose
		const savedPose = poseStack.pop()!

		isReturning = true

		try {
			// Use moveToPosition to return to the saved pose
			await armClient.current.moveToPosition(savedPose)
			xrToast.success('Returned to saved position')
		} catch (e) {
			console.error('[ArmTeleop] Failed to return to saved pose:', e)
			xrToast.danger('Failed to return to position')
		} finally {
			isReturning = false
		}
	}
</script>

{#if isControlling}
	<!-- Ghost Marker (Target Position in XR Space) -->
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
