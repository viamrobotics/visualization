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
	set(entity?: Entity): void
}

interface FocusedEntityContext {
	readonly current: Entity | undefined
	set(entity?: Entity): void
}

export const provideSelection = () => {
	const world = useWorld()
	const { scene } = useThrelte()

	let selected = $state.raw<Entity>()
	let focused = $state.raw<Entity>()

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
		set(entity: Entity) {
			selected = entity
		},
	}
	setContext<SelectedEntityContext>(selectedKey, selectedEntityContext)

	const focusedEntityContext = {
		get current() {
			return focused
		},
		set(entity: Entity) {
			focused = entity
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

const matrix = new Matrix4()

export const useSelectedObject3d = (): { current: Object3D | undefined } => {
	const selectedEntity = useSelectedEntity()
	const { scene } = useThrelte()

	const name = useTrait(() => selectedEntity.current, traits.Name)
	const arrow = useTrait(() => selectedEntity.current, traits.Arrow)

	const object = $derived.by(() => {
		if (!selectedEntity.current) {
			return
		}

		if (arrow.current) {
			const proxy = new Object3D()
			const mesh = scene.getObjectById(arrow.current.meshID) as BatchedMesh

			mesh?.getMatrixAt(arrow.current.instanceID, matrix)
			proxy.applyMatrix4(matrix)

			return proxy
		}

		if (!name.current) {
			return
		}

		return scene.getObjectByName(name.current)
	})

	return {
		get current() {
			return object
		},
	}
}
