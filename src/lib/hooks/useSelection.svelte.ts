import { isInstanceOf, useThrelte } from '@threlte/core'
import { getContext, setContext } from 'svelte'
import { Matrix4, Object3D } from 'three'
import type { Entity } from 'koota'
import { traits, useQuery, useTrait } from '$lib/ecs'

const hoverKey = Symbol('hover-context')
const selectionKey = Symbol('selection-context')
const focusKey = Symbol('focus-context')
const selectedObjectKey = Symbol('selected-frame-context')
const focusedObjectKey = Symbol('focused-frame-context')
const focusedObject3dKey = Symbol('focused-object-3d-context')

interface SelectionContext {
	readonly current: string | undefined
	setValue(uuid?: string): void
}

interface FocusContext {
	readonly current: string | undefined
	set(value?: string): void
}

interface HoverContext {
	readonly current: string | undefined
	set(value?: string): void
}

interface SelectedEntityContext {
	readonly current: Entity | undefined
}

interface FocusedEntityContext {
	readonly current: Entity | undefined
}

export const provideSelection = () => {
	let selected = $state<string>()
	let focused = $state<string>()
	let hovered = $state<string>()

	$inspect(selected)

	const selectionContext = {
		get current() {
			return selected
		},
		setValue(uuid?: string) {
			selected = uuid
		},
	}
	setContext<SelectionContext>(selectionKey, selectionContext)

	const focusContext = {
		get current() {
			return focused
		},
		set(value?: string) {
			focused = value
		},
	}
	setContext<FocusContext>(focusKey, focusContext)

	const hoverContext = {
		get current() {
			return hovered
		},
		set(value?: string) {
			hovered = value
		},
	}
	setContext<HoverContext>(hoverKey, hoverContext)

	const entities = useQuery()
	const selectedEntity = $derived(
		selected ? entities.current.find((entity) => entity.get(traits.UUID) === selected) : undefined
	)

	const selectedEntityContext = {
		get current() {
			return selectedEntity
		},
	}
	setContext<SelectedEntityContext>(selectedObjectKey, selectedEntityContext)

	const focusedEntity = $derived(
		focused ? entities.current.find((entity) => entity.get(traits.UUID) === focused) : undefined
	)

	const focusedEntityContext = {
		get current() {
			return focusedEntity
		},
	}
	setContext<FocusedEntityContext>(focusedObjectKey, focusedEntityContext)

	const { scene } = useThrelte()
	const uuid = useTrait(() => focusedEntity, traits.UUID)

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
		selection: selectionContext,
		focus: focusContext,
		hover: hoverContext,
	}
}

export const useSelected = () => {
	return getContext<SelectionContext>(selectionKey)
}

export const useFocused = () => {
	return getContext<FocusContext>(focusKey)
}

export const useFocusedEntity = (): { current: Entity | undefined } => {
	return getContext<FocusedEntityContext>(focusedObjectKey)
}

export const useSelectedEntity = (): { current: Entity | undefined } => {
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
