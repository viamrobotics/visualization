<script lang="ts">
	import type { CameraControlsRef } from '@threlte/extras'

	import { isInstanceOf, useTask } from '@threlte/core'
	import { PressedKeys } from 'runed'
	import { MathUtils, Vector3 } from 'three'

	import { useFocusedEntity, useSelectedEntity } from '$lib/hooks/useSelection.svelte'
	import { useSettings } from '$lib/hooks/useSettings.svelte'
	import { useVisibility } from '$lib/hooks/useVisibility.svelte'

	interface Props {
		cameraControls: CameraControlsRef
	}

	let { cameraControls }: Props = $props()

	const focusedEntity = useFocusedEntity()
	const selectedEntity = useSelectedEntity()

	const entity = $derived(focusedEntity.current ?? selectedEntity.current)

	const settings = useSettings()
	const visibility = useVisibility()

	const keys = new PressedKeys()
	const meta = $derived(keys.has('meta'))
	const w = $derived(keys.has('w'))
	const s = $derived(keys.has('s'))
	const a = $derived(keys.has('a'))
	const d = $derived(keys.has('d'))
	const r = $derived(keys.has('r'))
	const f = $derived(keys.has('f'))
	const up = $derived(keys.has('arrowup'))
	const left = $derived(keys.has('arrowleft'))
	const down = $derived(keys.has('arrowdown'))
	const right = $derived(keys.has('arrowright'))
	const anyKeysPressed = $derived(w || s || a || d || r || f || up || left || down || right)

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

	const { start, stop } = useTask(
		(delta) => {
			const dt = delta * 1000

			// Disallow keyboard navigation if the user is holding down the meta key
			if (meta) {
				return
			}

			const moveSpeed = getMovementScale() * dt
			const rotateSpeed = 0.1 * MathUtils.DEG2RAD * dt
			const tiltSpeed = 0.05 * MathUtils.DEG2RAD * dt
			const dollySpeed = 0.005 * dt
			const zoomSpeed = 0.5 * dt

			if (a) {
				cameraControls.truck(-moveSpeed * dt, 0, true)
			}

			if (d) {
				cameraControls.truck(moveSpeed * dt, 0, true)
			}

			if (w) {
				cameraControls.forward(moveSpeed * dt, true)
			}

			if (s) {
				cameraControls.forward(-moveSpeed * dt, true)
			}

			if (r) {
				if (isInstanceOf(cameraControls.camera, 'PerspectiveCamera')) {
					cameraControls.dolly(dollySpeed, true)
				} else {
					cameraControls.zoom(zoomSpeed, true)
				}
			}

			if (f) {
				if (isInstanceOf(cameraControls.camera, 'PerspectiveCamera')) {
					cameraControls.dolly(-dollySpeed, true)
				} else {
					cameraControls.zoom(-zoomSpeed, true)
				}
			}

			if (left) {
				cameraControls.rotate(-rotateSpeed, 0, true)
			}

			if (right) {
				cameraControls.rotate(rotateSpeed, 0, true)
			}

			if (up) {
				cameraControls.rotate(0, -tiltSpeed, true)
			}

			if (down) {
				cameraControls.rotate(0, tiltSpeed, true)
			}
		},
		{
			autoStart: false,
			autoInvalidate: false,
		}
	)

	$effect.pre(() => {
		if (anyKeysPressed) {
			start()
		} else {
			stop()
		}
	})

	keys.onKeys('escape', () => {
		if (keys.has('escape')) {
			focusedEntity.set()
		}
	})

	keys.onKeys('c', () => {
		settings.current.cameraMode =
			settings.current.cameraMode === 'perspective' ? 'orthographic' : 'perspective'
	})

	keys.onKeys('1', () => {
		settings.current.transformMode = 'translate'
	})

	keys.onKeys('2', () => {
		settings.current.transformMode = 'rotate'
	})

	keys.onKeys('3', () => {
		settings.current.transformMode = 'scale'
	})

	keys.onKeys('x', () => {
		settings.current.enableXR = !settings.current.enableXR
	})

	/**
	 * Handler for any keybindings that need to access the event object
	 */
	const onkeydown = (event: KeyboardEvent) => {
		const key = event.key.toLowerCase()

		if (key === 'h') {
			if (!entity) return

			event.stopImmediatePropagation()

			const visible = visibility.get(entity) ?? true

			visibility.set(entity, !visible)
			return
		}
	}
</script>

<svelte:window {onkeydown} />
