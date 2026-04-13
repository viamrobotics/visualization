import type { Entity } from 'koota'

import { getContext, setContext } from 'svelte'

import { useWorld } from '$lib/ecs'

import * as selectionTraits from './traits'

const key = Symbol('selection-plugin-context')

interface SelectionPluginContext {
	current: Entity[]
	addEntity: (entity: Entity) => void
	clearSelections: () => void
}

export const provideSelectionPlugin = () => {
	const world = useWorld()
	const entities = $state<Entity[]>([])

	const ctx = setContext<SelectionPluginContext>(key, {
		get current() {
			return entities.filter((entity) => world.has(entity))
		},
		addEntity(entity: Entity) {
			entities.push(entity)
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
