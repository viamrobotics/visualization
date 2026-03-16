<script lang="ts">
	import type { CameraControlsRef } from '@threlte/extras'

	import { useTask } from '@threlte/core'
	import { PressedKeys } from 'runed'
	import { MathUtils } from 'three'

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
	const any = $derived(w || s || a || d || r || f || up || left || down || right)

	const { start, stop } = useTask(
		(delta) => {
			const dt = delta * 1000

			// Disallow keyboard navigation if the user is holding down the meta key
			if (meta) {
				return
			}

			if (a) {
				cameraControls.truck(-0.01 * dt, 0, true)
			}

			if (d) {
				cameraControls.truck(0.01 * dt, 0, true)
			}

			if (w) {
				cameraControls.forward(0.01 * dt, true)
			}

			if (s) {
				cameraControls.forward(-0.01 * dt, true)
			}

			if (r) {
				cameraControls.dolly(0.01 * dt, true)
			}

			if (f) {
				cameraControls.dolly(-0.01 * dt, true)
			}

			if (left) {
				cameraControls.rotate(-0.1 * MathUtils.DEG2RAD * dt, 0, true)
			}

			if (right) {
				cameraControls.rotate(0.1 * MathUtils.DEG2RAD * dt, 0, true)
			}

			if (up) {
				cameraControls.rotate(0, -0.05 * MathUtils.DEG2RAD * dt, true)
			}

			if (down) {
				cameraControls.rotate(0, 0.05 * MathUtils.DEG2RAD * dt, true)
			}
		},
		{
			autoStart: false,
			autoInvalidate: false,
		}
	)

	$effect.pre(() => {
		if (any) {
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
