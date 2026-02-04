import { getContext, setContext } from 'svelte'
import { Vector3 } from 'three'
import type { Entity } from 'koota'

const hoverInfoKey = Symbol('hover-info-context')

interface HoverInfoContext {
	get entity(): Entity | undefined
	get position(): Vector3 | undefined
	set entity(entity: Entity | undefined)
	set position(position: Vector3 | undefined)
}

export const provideHoverInfo = (): HoverInfoContext => {
	let position = $state.raw<Vector3>()
	let entity = $state.raw<Entity>()

	const context: HoverInfoContext = {
		get position() {
			return position
		},
		get entity() {
			return entity
		},
		set entity(value: Entity | undefined) {
			entity = value
		},
        set position(value: Vector3 | undefined) {
            position = value
        }
	}

	setContext<HoverInfoContext>(hoverInfoKey, context)

	return context
}

export const useHoverInfo = (): HoverInfoContext => {
	return getContext<HoverInfoContext>(hoverInfoKey)
}

