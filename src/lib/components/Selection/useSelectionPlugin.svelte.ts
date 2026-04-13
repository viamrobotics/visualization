import type { QueryResult, Trait } from 'koota'

import { getContext, setContext } from 'svelte'

import { useQuery, useWorld } from '$lib/ecs'

import * as selectionTraits from './traits'

const key = Symbol('selection-plugin-context')

interface SelectionPluginContext {
	current: QueryResult<[Trait<() => boolean>]>
	clearSelections: () => void
}

export const provideSelectionPlugin = () => {
	const world = useWorld()
	const entities = useQuery(selectionTraits.SelectionEnclosedPoints)

	const ctx = setContext<SelectionPluginContext>(key, {
		get current() {
			return entities.current
		},
		clearSelections() {
			for (const entity of world.query(selectionTraits.SelectionEnclosedPoints)) {
				if (world.has(entity)) {
					entity.destroy()
				}
			}
		},
	})
	return ctx
}

export const useSelectionPlugin = () => {
	return getContext<SelectionPluginContext>(key)
}
