<script lang="ts">
	import { T, useTask } from '@threlte/core'
	import { useController, useXR, type XRController } from '@threlte/xr'
	import { ArmClient, GripperClient } from '@viamrobotics/sdk'
	import * as VIAM from '@viamrobotics/sdk'
	import { createResourceClient } from '@viamrobotics/svelte-sdk'
	import { Quaternion, Vector3 } from 'three'

	import { usePartID } from '$lib/hooks/usePartID.svelte'
	import { OrientationVector } from '$lib/math/OrientationVector'

	import { calculatePositionTarget, getFrameTransformationQuaternion } from './math'
	import { xrToast } from './toasts.svelte'

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
		scaleFactor = 1,
		hand = 'right',
		rotationEnabled = true,
	}: Props = $props()

	const partID = usePartID()

	// Capture initial prop values — parent uses {#key} to force remount on changes.
	// Wrapped in an IIFE to avoid Svelte's state_referenced_locally warning.
	// eslint-disable-next-line unicorn/no-unreadable-iife
	const { initialHand, initialGripperName } = (() => ({
		initialHand: hand,
		initialGripperName: gripperName,
	}))()

	const armClient = createResourceClient(
		ArmClient,
		() => partID.current,
		() => armName
	)

	const gripperClient = initialGripperName
		? createResourceClient(
				GripperClient,
				() => partID.current,
				() => initialGripperName
			)
		: undefined

	const { session } = useXR()
	const controller = useController(initialHand)

	let isControlling = $state(false)
	let wasPressed = false
	let wasTriggerPressed = false
	let wasBPressed = false
	let isSending = false
	let isReturning = false // Prevent control during return to saved pose
	let gripperStopTimeout: ReturnType<typeof setTimeout> | null = null

	let poseStack: VIAM.Pose[] = []

	let controllerRefPos = new Vector3()
	// The Controller's rotation at start, converted to Robot Frame
	let controllerRefRotRobot = new Quaternion()

	let robotRefPos = { x: 0, y: 0, z: 0 }
	let robotRefQuat = new Quaternion()
	let robotRefOV = new OrientationVector() // Keep default radians - setUnits breaks toQuaternion!

	// Offset from controller orientation to arm orientation
	// This maintains the relationship: armRot = controllerRot * offset
	let controllerToArmOffset = new Quaternion()

	const qTransform = getFrameTransformationQuaternion()

	let lastCommandTime = 0
	let errorTimeout = 0
	let lastErrorHapticTime = 0
	const COMMAND_INTERVAL = 11 // ms (90Hz)
	const ERROR_COOLDOWN = 1000 // ms
	const ERROR_HAPTIC_INTERVAL = 200 // ms between error haptic pulses
	let lastErrorToastTime = 0
	const ERROR_TOAST_COOLDOWN = 3000 // ms - don't spam error toasts

	function triggerHapticFeedback(intensity: number = 0.5, duration: number = 100) {
		const currentSession = $session
		if (!currentSession) return

		const inputSource = [...currentSession.inputSources].find((s) => s.handedness === initialHand)
		if (!inputSource?.gamepad?.hapticActuators?.length) return

		const actuator = inputSource.gamepad.hapticActuators[0]
		if ('pulse' in actuator) {
			actuator
				.pulse(intensity, duration)
				.catch((error) => console.warn('[ArmTeleop] Haptic pulse failed:', error))
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

	let ghostPos = new Vector3()
	let ghostRot = new Quaternion()
	let ghostPosArray = $state<[number, number, number]>([0, 0, 0])
	let ghostRotArray = $state<[number, number, number, number]>([0, 0, 0, 1])

	useTask(() => {
		const currentSession = $session
		if (!currentSession || !controller.current) return

		const inputSource = [...currentSession.inputSources].find((s) => s.handedness === initialHand)

		if (!inputSource || !inputSource.gamepad) return

		// Trigger (button 0) drives the gripper, squeeze (button 1) the arm, and B (button 5 on Quest controllers) the return to a saved pose.
		const trigger = inputSource.gamepad.buttons[0]
		const squeeze = inputSource.gamepad.buttons[1]
		const bButton = inputSource.gamepad.buttons[5]
		const isPressed = squeeze && squeeze.pressed
		const isTriggerPressed = trigger && trigger.pressed
		const isBPressed = bButton && bButton.pressed

		if (isPressed && !wasPressed) {
			if (armClient.current) {
				handleStartControl(controller.current)
			}
		} else if (!isPressed && wasPressed && isControlling) {
			isControlling = false
			triggerHapticFeedback(0.3, 80)
			handleStopControl()
		}

		if (gripperClient?.current) {
			if (isTriggerPressed && !wasTriggerPressed) {
				// Clear any pending stop timeout
				if (gripperStopTimeout) {
					clearTimeout(gripperStopTimeout)
					gripperStopTimeout = null
				}
				gripperClient.current.grab().catch((error) => console.warn('Gripper grab failed:', error))
			} else if (!isTriggerPressed && wasTriggerPressed) {
				// Clear any pending stop timeout
				if (gripperStopTimeout) {
					clearTimeout(gripperStopTimeout)
					gripperStopTimeout = null
				}
				gripperClient.current.open().catch((error) => console.warn('Gripper open failed:', error))

				gripperStopTimeout = setTimeout(() => {
					gripperClient?.current
						?.stop()
						.catch((error) => console.warn('Gripper stop failed:', error))
					gripperStopTimeout = null
				}, 1000)
			}
		}

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

		if (isControlling && armClient.current && !isReturning) {
			handleControlFrame(controller.current)
		}
	})

	/** Transform an XR-frame quaternion into the robot frame, `T * q * inv(T)`. */
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

			poseStack.push({ x, y, z, oX, oY, oZ, theta })

			// Use grip space for tracking
			const grip = c.grip
			if (!grip) {
				console.error('[ArmTeleop] No grip space found on controller')
				return
			}

			controllerRefPos.copy(grip.position)

			// Matches the Dart implementation's `referenceRotationQuaternionViamPhone`.
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

			triggerHapticFeedback(0.5, 100)
		} catch (error) {
			console.error('[ArmTeleop] Failed to start teleop:', error)
		}
	}

	async function handleStopControl() {
		try {
			await armClient.current!.getEndPosition()
		} catch (error) {
			console.error('[ArmTeleop] Failed to get final position:', error)
		}
	}

	function handleControlFrame(c: XRController) {
		const now = Date.now()

		const grip = c.grip
		if (!grip) return

		const currentControllerPos = grip.position
		const currentControllerRot = grip.quaternion

		const deltaXR = currentControllerPos.clone().sub(controllerRefPos)

		const targetPos = calculatePositionTarget(
			currentControllerPos,
			controllerRefPos,
			robotRefPos,
			qTransform,
			scaleFactor
		)

		let targetOV
		if (rotationEnabled) {
			// Transform the controller orientation from the XR frame into the robot frame with the sandwich transform `T * q * T^-1`.
			const currentRotRobot = transformToRobotFrame(currentControllerRot, qTransform).normalize()

			// 2. Apply offset to maintain initial controller→arm relationship
			// targetArmRot = currentControllerRot * offset
			const targetArmRotQuat = currentRotRobot.clone().multiply(controllerToArmOffset).normalize()

			// Radians here. The conversion to degrees happens when the command is sent.
			targetOV = new OrientationVector().setFromQuaternion(targetArmRotQuat)

			ghostRot.copy(currentControllerRot)
		} else {
			// Keep orientation fixed to start - use original OV
			targetOV = robotRefOV
			ghostRot.copy(grip.quaternion)
		}

		// --- Update Ghost Visualizer ---
		ghostPos.copy(controllerRefPos).add(deltaXR.multiplyScalar(scaleFactor))

		// The visualizer shows the raw controller rotation rather than the robot-frame rotation mapped back to XR, because raw rotation reads better as feedback for where your hand is.

		ghostPosArray = ghostPos.toArray()
		ghostRotArray = ghostRot.toArray()

		if (now - lastCommandTime < COMMAND_INTERVAL) return
		if (isSending) return

		if (now < errorTimeout) {
			if (now - lastErrorHapticTime > ERROR_HAPTIC_INTERVAL) {
				triggerHapticFeedback(0.7, 150)
				lastErrorHapticTime = now
			}
			return
		}

		lastCommandTime = now
		isSending = true

		if (Number.isNaN(targetPos.x) || Number.isNaN(targetOV.th)) {
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
					.catch((error) => {
						console.warn('Move failed:', error)
						errorTimeout = Date.now() + ERROR_COOLDOWN
						triggerHapticFeedback(0.8, 200)
						lastErrorHapticTime = Date.now()
						showArmErrorToast(error)
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
				.catch((error) => {
					console.warn('Move failed:', error)
					errorTimeout = Date.now() + ERROR_COOLDOWN
					triggerHapticFeedback(0.8, 200)
					lastErrorHapticTime = Date.now()
					showArmErrorToast(error)
				})
				.finally(() => {
					isSending = false
				})
		}
	}

	async function handleReturnToPose() {
		if (!armClient.current || poseStack.length === 0) return

		const savedPose = poseStack.pop()!

		isReturning = true

		try {
			await armClient.current.moveToPosition(savedPose)
			xrToast.success('Returned to saved position')
		} catch (error) {
			console.error('[ArmTeleop] Failed to return to saved pose:', error)
			xrToast.danger('Failed to return to position')
		} finally {
			isReturning = false
		}
	}
</script>

{#if isControlling}
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

	<T.Mesh position={controllerRefPos.toArray()}>
		<T.SphereGeometry args={[0.02]} />
		<T.MeshBasicMaterial
			color="gray"
			opacity={0.5}
			transparent
		/>
	</T.Mesh>
{/if}
