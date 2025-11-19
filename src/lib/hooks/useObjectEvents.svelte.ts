import { useCursor, type IntersectionEvent } from '@threlte/extras'
import { useFocused, useSelected } from './useSelection.svelte'
import { useVisibility } from './useVisibility.svelte'
import { Vector2 } from 'three'

export const useObjectEvents = (uuid: () => string | undefined) => {
	const selected = useSelected()
	const focused = useFocused()
	const visibility = useVisibility()
	const down = new Vector2()

	const cursor = useCursor()

	return {
		get visible() {
			return visibility.get(uuid() ?? '')
		},
		onpointerenter: (event: IntersectionEvent<MouseEvent>) => {
			event.stopPropagation()
			cursor.onPointerEnter()
		},
		onpointerleave: (event: IntersectionEvent<MouseEvent>) => {
			event.stopPropagation()
			cursor.onPointerLeave()
		},
		ondblclick: (event: IntersectionEvent<MouseEvent>) => {
			event.stopPropagation()
			focused.set(uuid())
		},
		onpointerdown: (event: IntersectionEvent<MouseEvent>) => {
			down.copy(event.pointer)
		},
		onclick: (event: IntersectionEvent<MouseEvent>) => {
			event.stopPropagation()

			if (down.distanceToSquared(event.pointer) < 0.1) {
				selected.setValue(uuid())
			}
		},
	}
}
