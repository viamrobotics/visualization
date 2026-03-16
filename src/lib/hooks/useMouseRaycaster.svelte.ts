import { useThrelte } from '@threlte/core'
import { EventDispatcher, type Intersection, Raycaster, Vector2 } from 'three'

const pointerDown = new Vector2()
const pointerUp = new Vector2()
const pointerMove = new Vector2()

type EventNames = 'click' | 'move' | 'pointerenter' | 'pointerleave'

interface RaycastEvent<T extends EventNames> {
	type: T
	intersections: Intersection[]
}

type Callback<T extends EventNames> = (event: RaycastEvent<T>) => void

export const useMouseRaycaster = (getOptions?: () => { enabled: boolean }) => {
	let intersections: Intersection[] = []

	const options = $derived({
		enabled: true,
		...getOptions?.(),
	})

	const eventDispatcher = new EventDispatcher<{
		click: RaycastEvent<'click'>
		move: RaycastEvent<'move'>
		pointerenter: RaycastEvent<'pointerenter'>
		pointerleave: RaycastEvent<'pointerleave'>
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

		const currentIntersections = raycaster.intersectObjects(scene.children, true)

		eventDispatcher.dispatchEvent({ type: 'click', intersections: currentIntersections })
	}

	const onPointerMove = (event: PointerEvent): void => {
		if (camera.current === undefined) {
			return
		}

		getNormalizedCoordinates(event, pointerMove)

		raycaster.setFromCamera(pointerMove, camera.current)

		const currentIntersections = raycaster.intersectObjects(scene.children, true)

		const enterIntersections = []
		const leaveIntersections = []

		for (const a of currentIntersections) {
			if (!intersections.some((b) => b.object.uuid === a.object.uuid)) {
				enterIntersections.push(a)
			}
		}

		for (const a of intersections) {
			if (!currentIntersections.some((b) => b.object.uuid === a.object.uuid)) {
				leaveIntersections.push(a)
			}
		}

		if (enterIntersections.length > 0) {
			eventDispatcher.dispatchEvent({ type: 'pointerenter', intersections: enterIntersections })
		}

		if (leaveIntersections.length > 0) {
			eventDispatcher.dispatchEvent({ type: 'pointerleave', intersections: leaveIntersections })
		}

		eventDispatcher.dispatchEvent({ type: 'move', intersections: currentIntersections })

		intersections = currentIntersections
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
		onclick: (cb: Callback<'click'>) => {
			$effect(() => {
				eventDispatcher.addEventListener('click', cb)
				return () => eventDispatcher.removeEventListener('click', cb)
			})
		},
		onmove: (cb: Callback<'move'>) => {
			$effect(() => {
				eventDispatcher.addEventListener('move', cb)
				return () => eventDispatcher.removeEventListener('move', cb)
			})
		},
		onpointerenter: (cb: Callback<'pointerenter'>) => {
			$effect(() => {
				eventDispatcher.addEventListener('pointerenter', cb)
				return () => eventDispatcher.removeEventListener('pointerenter', cb)
			})
		},
		onpointerleave: (cb: Callback<'pointerleave'>) => {
			$effect(() => {
				eventDispatcher.addEventListener('pointerleave', cb)
				return () => eventDispatcher.removeEventListener('pointerleave', cb)
			})
		},
	}
}
