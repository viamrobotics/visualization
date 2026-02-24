<script lang="ts">
	import { useTask, T } from '@threlte/core'
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
	import { useSteamVRBridge, type SteamVRController } from '$lib/hooks/useSteamVRBridge.svelte'

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
	const bridge = useSteamVRBridge()

	// Capture initial prop values — parent uses {#key} to force remount on changes.
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

	// Get the controller state from the bridge
	function getController(): SteamVRController {
		return initialHand === 'left' ? bridge.state.left : bridge.state.right
	}

	let isControlling = $state(false)
	let wasGripPressed = false
	let wasTriggerPressed = false
	let wasMenuPressed = false
	let isSending = false
	let isReturning = false
	let gripperStopTimeout: ReturnType<typeof setTimeout> | null = null

	// Stack to store saved poses - can return to previous positions
	let poseStack: VIAM.Pose[] = []

	// Reference States
	let controllerRefPos = new Vector3()
	let controllerRefRotRobot = new Quaternion()

	// Robot Reference (Viam Checkpoint)
	let robotRefPos = { x: 0, y: 0, z: 0 }
	let robotRefQuat = new Quaternion()
	let robotRefOV = new OrientationVector()

	// Offset from controller orientation to arm orientation
	let controllerToArmOffset = new Quaternion()

	// Transformation Frame
	const qTransform = getFrameTransformationQuaternion()

	// Throttling
	let lastCommandTime = 0
	let errorTimeout = 0
	let lastErrorHapticTime = 0
	const COMMAND_INTERVAL = 11 // ms (90Hz)
	const ERROR_COOLDOWN = 1000 // ms

	// Ghost Visualization State
	let ghostPos = new Vector3()
	let ghostRot = new Quaternion()
	let ghostPosArray = $state<[number, number, number]>([0, 0, 0])
	let ghostRotArray = $state<[number, number, number, number]>([0, 0, 0, 1])

	// Helper to transform quaternion to Robot Frame: T * q * inv(T)
	function transformToRobotFrame(q: Quaternion, transform: Quaternion) {
		const transformInv = transform.clone().invert()
		return transform.clone().multiply(q).multiply(transformInv)
	}

	useTask(() => {
		const ctrl = getController()
		if (!ctrl.connected || bridge.state.status !== 'connected') return

		// --- Edge Detection ---
		const gripPressed = ctrl.grip
		const triggerPressed = ctrl.triggerPressed
		const menuPressed = ctrl.menu

		// Grip: start/stop arm control
		if (gripPressed && !wasGripPressed) {
			if (armClient.current) {
				handleStartControl(ctrl)
			}
		} else if (!gripPressed && wasGripPressed) {
			if (isControlling) {
				isControlling = false
				handleStopControl()
			}
		}

		// Trigger: gripper control
		if (gripperClient?.current) {
			if (triggerPressed && !wasTriggerPressed) {
				if (gripperStopTimeout) {
					clearTimeout(gripperStopTimeout)
					gripperStopTimeout = null
				}
				gripperClient.current.grab().catch((e) => console.warn('Gripper grab failed:', e))
			} else if (!triggerPressed && wasTriggerPressed) {
				if (gripperStopTimeout) {
					clearTimeout(gripperStopTimeout)
					gripperStopTimeout = null
				}
				gripperClient.current.open().catch((e) => console.warn('Gripper open failed:', e))
				gripperStopTimeout = setTimeout(() => {
					gripperClient?.current?.stop().catch((e) => console.warn('Gripper stop failed:', e))
					gripperStopTimeout = null
				}, 1000)
			}
		}

		// Menu: return to saved pose
		if (menuPressed && !wasMenuPressed) {
			if (poseStack.length > 0) {
				handleReturnToPose()
			}
		}

		wasGripPressed = gripPressed
		wasTriggerPressed = triggerPressed
		wasMenuPressed = menuPressed

		// Control Loop
		if (isControlling && armClient.current && !isReturning) {
			handleControlFrame(ctrl)
		}
	})

	async function handleStartControl(ctrl: SteamVRController) {
		try {
			const currentPose = await armClient.current!.getEndPosition()
			if (!currentPose) {
				console.warn('[SteamVRTeleop] Could not get end position')
				return
			}

			const { x, y, z, oX, oY, oZ, theta } = currentPose

			robotRefPos = { x, y, z }
			robotRefOV.set(oX, oY, oZ, (theta * Math.PI) / 180)
			robotRefQuat = robotRefOV.toQuaternion(new Quaternion()).normalize()

			poseStack.push({ x, y, z, oX, oY, oZ, theta })

			controllerRefPos.copy(ctrl.position)

			// Transform controller rotation to Robot Frame
			controllerRefRotRobot = transformToRobotFrame(ctrl.rotation, qTransform).normalize()

			// Compute offset: armRot = controllerRot * offset
			controllerToArmOffset = controllerRefRotRobot
				.clone()
				.invert()
				.multiply(robotRefQuat)
				.normalize()

			errorTimeout = 0
			isControlling = true
		} catch (e) {
			console.error('[SteamVRTeleop] Failed to start teleop:', e)
		}
	}

	async function handleStopControl() {
		try {
			await armClient.current!.getEndPosition()
		} catch (e) {
			console.error('[SteamVRTeleop] Failed to get final position:', e)
		}
	}

	function handleControlFrame(ctrl: SteamVRController) {
		const now = Date.now()

		const currentControllerPos = ctrl.position
		const currentControllerRot = ctrl.rotation

		// Calculate Delta for visualizer
		const deltaXR = currentControllerPos.clone().sub(controllerRefPos)

		// --- Position ---
		const targetPos = calculatePositionTarget(
			currentControllerPos,
			controllerRefPos,
			robotRefPos,
			qTransform,
			scaleFactor
		)

		// --- Rotation ---
		let targetOV
		if (rotationEnabled) {
			const currentRotRobot = transformToRobotFrame(currentControllerRot, qTransform).normalize()
			const targetArmRotQuat = currentRotRobot.clone().multiply(controllerToArmOffset).normalize()
			targetOV = new OrientationVector().setFromQuaternion(targetArmRotQuat)
			ghostRot.copy(currentControllerRot)
		} else {
			targetOV = robotRefOV
			ghostRot.copy(ctrl.rotation)
		}

		// --- Update Ghost ---
		ghostPos.copy(controllerRefPos).add(deltaXR.multiplyScalar(scaleFactor))
		ghostPosArray = ghostPos.toArray()
		ghostRotArray = ghostRot.toArray()

		// --- Send Command ---
		if (now - lastCommandTime < COMMAND_INTERVAL) return
		if (isSending) return

		if (now < errorTimeout) {
			return
		}

		lastCommandTime = now
		isSending = true

		if (isNaN(targetPos.x) || isNaN(targetOV.th)) {
			console.warn('Teleop Safety: NaN detected', targetPos, targetOV)
			isSending = false
			return
		}

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
			})
			.finally(() => {
				isSending = false
			})
	}

	async function handleReturnToPose() {
		if (!armClient.current || poseStack.length === 0) return

		const savedPose = poseStack.pop()!
		isReturning = true

		try {
			await armClient.current.moveToPosition(savedPose)
		} catch (e) {
			console.error('[SteamVRTeleop] Failed to return to saved pose:', e)
		} finally {
			isReturning = false
		}
	}
</script>

{#if isControlling}
	<!-- Ghost Marker (Target Position) -->
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
