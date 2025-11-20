import { isInstanceOf, useThrelte } from '@threlte/core'
import { getContext, setContext } from 'svelte'
import { Matrix4, Object3D } from 'three'
import type { Entity } from 'koota'
import { traits, useQuery, useTrait } from '$lib/ecs'

const selectionKey = Symbol('selection-context')
const focusKey = Symbol('focus-context')
const selectedObjectKey = Symbol('selected-frame-context')
const focusedObjectKey = Symbol('focused-frame-context')
const focusedObject3dKey = Symbol('focused-object-3d-context')

interface SelectedEntityContext {
	readonly current: Entity | undefined
	set(entity?: Entity): void
}

interface FocusedEntityContext {
	readonly current: Entity | undefined
	set(entity?: Entity): void
}

export const provideSelection = () => {
	let selected = $state.raw<Entity>()
	let focused = $state.raw<Entity>()

	$inspect(selected)

	const selectedEntityContext = {
		get current() {
			return selected
		},
		set(entity: Entity) {
			selected = entity
		},
	}
	setContext<SelectedEntityContext>(selectedObjectKey, selectedEntityContext)

	const focusedEntityContext = {
		get current() {
			return focused
		},
		set(entity: Entity) {
			focused = entity
		},
	}
	setContext<FocusedEntityContext>(focusedObjectKey, focusedEntityContext)

	const { scene } = useThrelte()
	const uuid = useTrait(() => focused, traits.UUID)

	const focusedObject3d = $derived.by(() => {
		if (!uuid.current) return

		const object = scene.getObjectByProperty('uuid', uuid.current)?.clone()

		object?.traverse((child) => {
			if (isInstanceOf(child, 'LineSegments')) {
				child.raycast = () => null
			}
		})

		return object
	})

	setContext(focusedObject3dKey, {
		get current() {
			return focusedObject3d
		},
	})

	return {
		selection: selectedEntityContext,
		focus: focusedEntityContext,
	}
}

export const useFocusedEntity = (): FocusedEntityContext => {
	return getContext<FocusedEntityContext>(focusedObjectKey)
}

export const useSelectedEntity = (): SelectedEntityContext => {
	return getContext<SelectedEntityContext>(selectedObjectKey)
}

export const useFocusedObject3d = (): { current: Object3D | undefined } => {
	return getContext(focusedObject3dKey)
}

const matrix = new Matrix4()

export const useSelectedObject3d = (): { current: Object3D | undefined } => {
	const selectedEntity = useSelectedEntity()
	const { scene } = useThrelte()
	const uuid = useTrait(() => selectedEntity.current, traits.UUID)

	const object = $derived.by(() => {
		if (!selectedEntity.current) {
			return
		}

		// if (selectedObject.current.metadata.batched) {
		// 	const proxy = new Object3D()
		// 	const { id, object } = selectedObject.current.metadata.batched

		// 	object.getMatrixAt(id, matrix)
		// 	proxy.applyMatrix4(matrix)

		// 	return proxy
		// }

		return scene.getObjectByProperty('uuid', uuid.current)
	})

	return {
		get current() {
			return object
		},
	}
}
