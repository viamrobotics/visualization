import { Vector2, Raycaster, EventDispatcher, type Intersection } from 'three'
import { useThrelte } from '@threlte/core'

const pointerDown = new Vector2()
const pointerUp = new Vector2()
const pointerMove = new Vector2()

interface Event<T> {
	type: T
	intersections: Intersection[]
}

export const useMouseRaycaster = (getOptions?: () => { enabled: boolean }) => {
	const options = $derived({
		enabled: true,
		...getOptions?.(),
	})

	const eventDispatcher = new EventDispatcher<{
		click: Event<'click'>
		move: Event<'move'>
	}>()
	const raycaster = new Raycaster()

	const { camera, dom, scene } = useThrelte()

	const getNormalizedCoordinates = (event: PointerEvent, vec: Vector2): void => {
		const rect = dom.getBoundingClientRect()

		/*
		 * Calculate pointer position in normalized device coordinates
		 * (-1 to +1) for both components
		 */
		vec.x = ((event.clientX - rect.x) / dom.clientWidth) * 2 - 1
		vec.y = -(((event.clientY - rect.y) / dom.clientHeight) * 2) + 1
	}

	const onPointerDown = (event: PointerEvent): void => {
		getNormalizedCoordinates(event, pointerDown)
	}

	const onPointerUp = (event: PointerEvent): void => {
		if (camera.current === undefined) {
			return
		}

		getNormalizedCoordinates(event, pointerUp)

		if (pointerDown.sub(pointerUp).lengthSq() > 0.001) {
			return
		}

		// Update the picking ray with the camera and pointer position
		raycaster.setFromCamera(pointerUp, camera.current)

		const intersections = raycaster.intersectObjects(scene.children, true)

		eventDispatcher.dispatchEvent({ type: 'click', intersections })
	}

	const onPointerMove = (event: PointerEvent): void => {
		if (camera.current === undefined) {
			return
		}

		getNormalizedCoordinates(event, pointerMove)

		raycaster.setFromCamera(pointerMove, camera.current)

		const intersections = raycaster.intersectObjects(scene.children, true)

		eventDispatcher.dispatchEvent({ type: 'move', intersections })
	}

	$effect(() => {
		if (!options.enabled) {
			return
		}

		dom.addEventListener('pointermove', onPointerMove, { passive: true })
		dom.addEventListener('pointerdown', onPointerDown, { passive: true })
		dom.addEventListener('pointerup', onPointerUp, { passive: true })

		return () => {
			dom.removeEventListener('pointerdown', onPointerDown)
			dom.removeEventListener('pointerup', onPointerUp)
			dom.removeEventListener('pointermove', onPointerMove)
		}
	})

	return {
		raycaster,
		onclick: (cb: (event: Event<'click'>) => void) => {
			$effect(() => {
				eventDispatcher.addEventListener('click', cb)
				return () => eventDispatcher.removeEventListener('click', cb)
			})
		},
		onmove: (cb: (event: Event<'move'>) => void) => {
			$effect(() => {
				eventDispatcher.addEventListener('move', cb)
				return () => eventDispatcher.removeEventListener('move', cb)
			})
		},
	}
}
