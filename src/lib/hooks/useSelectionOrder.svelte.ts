import type { Entity } from 'koota'

import { getContext, setContext, untrack } from 'svelte'

import { traits, useWorld } from '#lib/ecs/index.js'

const SELECTION_ORDER_KEY = Symbol('selection-order')

interface SelectionOrderContext {
	/** The selected entities, first selected first. */
	readonly current: readonly Entity[]
}

/**
 * Tracks the order entities were selected in. `traits.Selected` is a bare tag, and a
 * query over it reorders when an entity leaves it, so the first-selected entity, which
 * the transform gizmo pivots on, is kept here instead.
 */
export const provideSelectionOrder = (): SelectionOrderContext => {
	const world = useWorld()

	let order = $state.raw<readonly Entity[]>([])

	$effect(() => {
		// Subscribers run inside whichever effect changed the selection. Untracked, so reading
		// `order` doesn't make that effect depend on it.
		const offAdd = world.onAdd(traits.Selected, (entity) => {
			untrack(() => (order = [...order.filter((member) => member !== entity), entity]))
		})
		const offRemove = world.onRemove(traits.Selected, (entity) => {
			untrack(() => (order = order.filter((member) => member !== entity)))
		})

		// A selection made before this mounted, such as a deep link, has no order to recover.
		untrack(() => (order = [...world.query(traits.Selected)]))

		return () => {
			offAdd()
			offRemove()
		}
	})

	const context: SelectionOrderContext = {
		get current() {
			return order
		},
	}
	setContext(SELECTION_ORDER_KEY, context)
	return context
}

export const useSelectionOrder = (): SelectionOrderContext =>
	getContext<SelectionOrderContext>(SELECTION_ORDER_KEY)
