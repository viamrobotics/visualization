import type { Entity } from 'koota'
import type { QueryResult, Trait } from 'koota'

import { getContext, setContext } from 'svelte'

import { useWorld } from '$lib/ecs'

import * as selectionTraits from './traits'

const key = Symbol('selection-context')

interface SelectionContext {
	current: QueryResult<[Trait<() => boolean>]>
	selectionCallbacks: ((entity: Entity) => void)[]
	clearSelections: () => void
	registerSelectionCallback: (callback: (entity: Entity) => void) => void
}

export const provideSelection = () => {
	const callbacks = $state.raw<((entity: Entity) => void)[]>([])
	const world = useWorld()

	const ctx = setContext<SelectionContext>(key, {
		get current() {
			return world.query(selectionTraits.SelectionEnclosedPoints)
		},
		get selectionCallbacks() {
			return callbacks
		},
		clearSelections() {
			for (const entity of world.query(selectionTraits.SelectionEnclosedPoints)) {
				if (world.has(entity)) {
					entity.destroy()
				}
			}
		},
		registerSelectionCallback(callback) {
			callbacks.push(callback)
		},
	})
	return ctx
}

export const useSelection = () => {
	return getContext<SelectionContext>(key)
}
