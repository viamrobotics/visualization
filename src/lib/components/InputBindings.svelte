<script lang="ts">
	import type { CameraControlsRef } from '@threlte/extras'

	import { isInstanceOf, useTask } from '@threlte/core'
	import { useGamepad, useInputMap, useKeyboard } from '@threlte/extras'
	import { MathUtils, Vector3 } from 'three'

	interface Props {
		cameraControls: CameraControlsRef
	}

	let { cameraControls }: Props = $props()

	const keyboard = useKeyboard()
	const gamepad = useGamepad()
	const input = useInputMap(
		({ key, gamepadAxis, gamepadButton }) => ({
			truckLeft: [key('a'), gamepadAxis('leftStick', 'x', -1)],
			truckRight: [key('d'), gamepadAxis('leftStick', 'x', 1)],
			forward: [key('w'), gamepadAxis('leftStick', 'y', -1)],
			backward: [key('s'), gamepadAxis('leftStick', 'y', 1)],
			dollyIn: [key('e'), gamepadButton('rightBumper')],
			dollyOut: [key('q'), gamepadButton('leftBumper')],
			rotateLeft: [key('arrowleft'), gamepadAxis('rightStick', 'x', -1)],
			rotateRight: [key('arrowright'), gamepadAxis('rightStick', 'x', 1)],
			tiltUp: [key('arrowup'), gamepadAxis('rightStick', 'y', 1)],
			tiltDown: [key('arrowdown'), gamepadAxis('rightStick', 'y', -1)],
		}),
		{ keyboard, gamepad }
	)

	const truckAxis = $derived(input.axis('truckLeft', 'truckRight'))
	const forwardAxis = $derived(input.axis('backward', 'forward'))
	const dollyAxis = $derived(input.axis('dollyOut', 'dollyIn'))
	const yawAxis = $derived(input.axis('rotateLeft', 'rotateRight'))
	const pitchAxis = $derived(input.axis('tiltUp', 'tiltDown'))

	const anyKeysPressed = $derived(
		truckAxis !== 0 || forwardAxis !== 0 || dollyAxis !== 0 || yawAxis !== 0 || pitchAxis !== 0
	)

	const target = new Vector3()

	const PERSPECTIVE_DISTANCE_FACTOR = 0.0001
	const PERSPECTIVE_MIN_SPEED = 0.00001

	const ORTHOGRAPHIC_ZOOM_FACTOR = 0.1
	const ORTHOGRAPHIC_MIN_SPEED = 0.00005

	const FALLBACK_SPEED = 0.001

	const getMovementScale = () => {
		const camera = cameraControls.camera

		if (isInstanceOf(camera, 'PerspectiveCamera')) {
			cameraControls.getTarget(target)

			const distance = camera.position.distanceTo(target)
			const scaled = distance * PERSPECTIVE_DISTANCE_FACTOR
			return Math.max(scaled, PERSPECTIVE_MIN_SPEED)
		}

		if (isInstanceOf(camera, 'OrthographicCamera')) {
			const scaled = ORTHOGRAPHIC_ZOOM_FACTOR / camera.zoom
			return Math.max(scaled, ORTHOGRAPHIC_MIN_SPEED)
		}

		return FALLBACK_SPEED
	}

	useTask(
		(delta) => {
			const dt = delta * 1000

			// Disallow keyboard navigation while the user holds meta or control.
			if (keyboard.key('meta').pressed || keyboard.key('control').pressed) {
				return
			}

			const moveSpeed = getMovementScale() * dt
			const rotateSpeed = 0.1 * MathUtils.DEG2RAD * dt
			const tiltSpeed = 0.05 * MathUtils.DEG2RAD * dt
			const dollySpeed = 0.005 * dt
			const zoomSpeed = 0.5 * dt

			if (truckAxis !== 0) {
				cameraControls.truck(truckAxis * moveSpeed * dt, 0, true)
			}

			if (forwardAxis !== 0) {
				cameraControls.forward(forwardAxis * moveSpeed * dt, true)
			}

			if (dollyAxis !== 0) {
				if (isInstanceOf(cameraControls.camera, 'PerspectiveCamera')) {
					cameraControls.dolly(dollyAxis * dollySpeed, true)
				} else {
					cameraControls.zoom(dollyAxis * zoomSpeed, true)
				}
			}

			if (yawAxis !== 0) {
				cameraControls.rotate(yawAxis * rotateSpeed, 0, true)
			}

			if (pitchAxis !== 0) {
				cameraControls.rotate(0, pitchAxis * tiltSpeed, true)
			}
		},
		{
			after: input.task,
			running: () => anyKeysPressed,
			autoInvalidate: false,
		}
	)
</script>
