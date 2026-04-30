<script lang="ts">
	import type { CameraControlsRef } from '@threlte/extras'

	import { isInstanceOf, useTask } from '@threlte/core'
	import { useInputMap, useKeyboard } from '@threlte/extras'
	import { MathUtils, Vector3 } from 'three'

	import { traits } from '$lib/ecs'
	import { useFocusedEntity, useSelectedEntity } from '$lib/hooks/useSelection.svelte'
	import { useSettings } from '$lib/hooks/useSettings.svelte'

	interface Props {
		cameraControls: CameraControlsRef
	}

	let { cameraControls }: Props = $props()

	const focusedEntity = useFocusedEntity()
	const selectedEntity = useSelectedEntity()

	const entity = $derived(focusedEntity.current ?? selectedEntity.current)

	const settings = useSettings()

	const keyboard = useKeyboard()
	const input = useInputMap(
		({ key }) => ({
			truckLeft: [key('a')],
			truckRight: [key('d')],
			forward: [key('w')],
			backward: [key('s')],
			dollyIn: [key('r')],
			dollyOut: [key('f')],
			rotateLeft: [key('arrowleft')],
			rotateRight: [key('arrowright')],
			tiltUp: [key('arrowup')],
			tiltDown: [key('arrowdown')],
		}),
		{ keyboard }
	)

	const truckAxis = $derived(input.axis('truckLeft', 'truckRight'))
	const forwardAxis = $derived(input.axis('backward', 'forward'))
	const dollyAxis = $derived(input.axis('dollyOut', 'dollyIn'))
	const yawAxis = $derived(input.axis('rotateLeft', 'rotateRight'))
	const pitchAxis = $derived(input.axis('tiltUp', 'tiltDown'))

	const anyKeysPressed = $derived(
		truckAxis !== 0 ||
			forwardAxis !== 0 ||
			dollyAxis !== 0 ||
			yawAxis !== 0 ||
			pitchAxis !== 0
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

			// Disallow keyboard navigation if the user is holding down the meta key
			if (keyboard.key('meta').pressed) {
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

	keyboard.on('keydown', (event) => {
		if (event.repeat) return

		const key = event.key.toLowerCase()

		switch (key) {
			case 'escape': {
				focusedEntity.set()
				return
			}
			case 'c': {
				settings.current.cameraMode =
					settings.current.cameraMode === 'perspective' ? 'orthographic' : 'perspective'
				return
			}
			case '1': {
				settings.current.transformMode = 'translate'
				return
			}
			case '2': {
				settings.current.transformMode = 'rotate'
				return
			}
			case '3': {
				settings.current.transformMode = 'scale'
				return
			}
			case 'x': {
				settings.current.enableXR = !settings.current.enableXR
				return
			}
			case 'h': {
				if (!entity) return

				event.stopImmediatePropagation()

				if (entity.has(traits.Invisible)) {
					entity.remove(traits.Invisible)
				} else {
					entity.add(traits.Invisible)
				}

				return
			}
		}
	})
</script>
