import { isInstanceOf, useThrelte } from '@threlte/core'
import { getContext, setContext } from 'svelte'
import { Matrix4, Object3D } from 'three'
import { useObjects } from './useObjects.svelte'
import type { WorldObject } from '$lib/WorldObject.svelte'

const hoverKey = Symbol('hover-context')
const selectionKey = Symbol('selection-context')
const focusKey = Symbol('focus-context')
const selectedObjectKey = Symbol('selected-frame-context')
const focusedObjectKey = Symbol('focused-frame-context')
const focusedObject3dKey = Symbol('focused-object-3d-context')

interface SelectionContext {
	readonly current: string | undefined
	set(value?: string): void
}

interface FocusContext {
	readonly current: string | undefined
	set(value?: string): void
}

interface HoverContext {
	readonly current: string | undefined
	set(value?: string): void
}

interface SelectedWorldObjectContext {
	readonly current: WorldObject | undefined
}

interface FocusedWorldObjectContext {
	readonly current: WorldObject | undefined
}

export const provideSelection = () => {
	let selected = $state<string>()
	let focused = $state<string>()
	let hovered = $state<string>()

	const selectionContext = {
		get current() {
			return selected
		},
		set(value?: string) {
			selected = value
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

	const objects = useObjects()
	const selectedObject = $derived(objects.current.find((object) => object.uuid === selected))

	const selectedObjectContext = {
		get current() {
			return selectedObject
		},
	}
	setContext<SelectedWorldObjectContext>(selectedObjectKey, selectedObjectContext)
	const focusedObject = $derived(objects.current.find((object) => object.uuid === focused))

	const focusedObjectContext = {
		get current() {
			return focusedObject
		},
	}
	setContext<FocusedWorldObjectContext>(focusedObjectKey, focusedObjectContext)

	const { scene } = useThrelte()
	const uuid = $derived(focusedObject?.uuid)
	const focusedObject3d = $derived.by(() => {
		if (!uuid) return

		const object = scene.getObjectByProperty('uuid', uuid)?.clone()

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

export const useFocusedObject = (): { current: WorldObject | undefined } => {
	return getContext<FocusedWorldObjectContext>(focusedObjectKey)
}

export const useSelectedObject = (): { current: WorldObject | undefined } => {
	return getContext<SelectedWorldObjectContext>(selectedObjectKey)
}

export const useFocusedObject3d = (): { current: Object3D | undefined } => {
	return getContext(focusedObject3dKey)
}

const matrix = new Matrix4()

export const useSelectedObject3d = (): { current: Object3D | undefined } => {
	const selectedObject = useSelectedObject()
	const { scene } = useThrelte()

	const object = $derived.by(() => {
		if (!selectedObject.current) {
			return
		}

		if (selectedObject.current.metadata.batched) {
			const proxy = new Object3D()
			const { id, object } = selectedObject.current.metadata.batched

			object.getMatrixAt(id, matrix)
			proxy.applyMatrix4(matrix)

			return proxy
		}

		return scene.getObjectByProperty('uuid', selectedObject.current.uuid)
	})

	return {
		get current() {
			return object
		},
	}
}
