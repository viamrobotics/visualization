import { useCursor, type IntersectionEvent } from '@threlte/extras'
import { useFocused, useSelected } from './useSelection.svelte'
import { useVisibility } from './useVisibility.svelte'
import { Vector2 } from 'three'
import { useSettings } from './useSettings.svelte'

export const useObjectEvents = (uuid: () => string) => {
	const settings = useSettings()
	const selected = useSelected()
	const focused = useFocused()
	const visibility = useVisibility()
	const down = new Vector2()

	const measureCursor = useCursor('crosshair')
	const hoverCursor = useCursor()
	const measuring = $derived(settings.current.enableMeasure)
	const cursor = $derived(measuring ? measureCursor : hoverCursor)

	return {
		get visible() {
			return visibility.get(uuid())
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

			if (measuring) {
				return
			}

			focused.set(uuid())
		},
		onpointerdown: (event: IntersectionEvent<MouseEvent>) => {
			down.copy(event.pointer)
		},
		onclick: (event: IntersectionEvent<MouseEvent>) => {
			event.stopPropagation()

			if (measuring) {
				return
			}

			if (down.distanceToSquared(event.pointer) < 0.1) {
				selected.set(uuid())
			}
		},
	}
}
