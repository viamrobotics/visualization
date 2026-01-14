import { isInstanceOf, useThrelte } from '@threlte/core'
import { getContext, setContext } from 'svelte'
import { BatchedMesh, Matrix4, Object3D } from 'three'
import type { Entity } from 'koota'
import { traits, useTrait, useWorld } from '$lib/ecs'

const selectedKey = Symbol('selected-frame-context')
const focusedKey = Symbol('focused-frame-context')
const focusedObject3dKey = Symbol('focused-object-3d-context')

interface SelectedEntityContext {
	readonly current: Entity | undefined
	readonly instance: number | undefined

	set(entity?: Entity, instance?: number): void
}

interface FocusedEntityContext {
	readonly current: Entity | undefined
	readonly instance: number | undefined

	set(entity?: Entity, instance?: number): void
}

export const provideSelection = () => {
	const world = useWorld()
	const { scene } = useThrelte()

	let selected = $state.raw<Entity>()
	let selectedInstance = $state<number>()
	let focused = $state.raw<Entity>()
	let focusedInstance = $state<number>()

	$effect(() => {
		return world.onRemove(traits.Name, (entity) => {
			if (entity === selected) selected = undefined
			if (entity === focused) focused = undefined
		})
	})

	const selectedEntityContext = {
		get current() {
			return selected
		},
		get instance() {
			return selectedInstance
		},
		set(entity: Entity, instance?: number) {
			selected = entity
			selectedInstance = instance
		},
	}
	setContext<SelectedEntityContext>(selectedKey, selectedEntityContext)

	const focusedEntityContext = {
		get current() {
			return focused
		},
		get instance() {
			return focusedInstance
		},
		set(entity: Entity, instance?: number) {
			focused = entity
			focusedInstance = instance
		},
	}
	setContext<FocusedEntityContext>(focusedKey, focusedEntityContext)

	const focusedObject3d = $derived.by(() => {
		const name = focused?.get(traits.Name)

		if (!name) {
			return
		}

		const object = scene.getObjectByName(name)?.clone()

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
	return getContext<FocusedEntityContext>(focusedKey)
}

export const useSelectedEntity = (): SelectedEntityContext => {
	return getContext<SelectedEntityContext>(selectedKey)
}

export const useFocusedObject3d = (): { current: Object3D | undefined } => {
	return getContext(focusedObject3dKey)
}

export const useSelectedObject3d = (): { current: Object3D | undefined } => {
	const selectedEntity = useSelectedEntity()
	const { scene } = useThrelte()

	const object = $derived.by(() => {
		if (!selectedEntity.current) {
			return
		}

		return scene.getObjectByName(selectedEntity.current as unknown as string)
	})

	return {
		get current() {
			return object
		},
	}
}
