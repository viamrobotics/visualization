import { getContext, setContext } from 'svelte'
import { Vector3 } from 'three'
import type { Entity } from 'koota'

const hoverInfoKey = Symbol('hover-info-context')

interface HoverInfoContext {
	get entity(): Entity | undefined
	get index(): number | undefined
	get position(): Vector3 | undefined
	set entity(entity: Entity | undefined)
	set index(index: number | undefined)
	set position(position: Vector3 | undefined)
}

export const provideHoverInfo = (): HoverInfoContext => {
	let position = $state.raw<Vector3>()
	let entity = $state.raw<Entity>()
	let index = $state.raw<number>()

	const context: HoverInfoContext = {
		get index() {
			return index
		},
		get position() {
			return position
		},
		get entity() {
			return entity
		},
		set index(value: number | undefined) {
			index = value
		},
		set entity(value: Entity | undefined) {
			entity = value
		},
		set position(value: Vector3 | undefined) {
			position = value
		},
	}

	setContext<HoverInfoContext>(hoverInfoKey, context)

	return context
}

export const useHoverInfo = (): HoverInfoContext => {
	return getContext<HoverInfoContext>(hoverInfoKey)
}
