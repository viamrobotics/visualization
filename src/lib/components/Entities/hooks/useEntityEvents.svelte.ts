import type { Entity } from 'koota'

import { type IntersectionEvent, useCursor } from '@threlte/extras'
import { MathUtils, Matrix4, Quaternion, Vector2 } from 'three'

import { setOrAddTrait, traits, useTrait, useWorld } from '$lib/ecs'
import { type HoverInfo, updateHoverInfo } from '$lib/HoverUpdater.svelte'
import { OrientationVector } from '$lib/math/OrientationVector'

const tempHoverMatrix = new Matrix4()
const hoverQuat = new Quaternion()
const hoverOv = new OrientationVector()

const infoToLocalMatrix = (info: HoverInfo, out: Matrix4) => {
	hoverOv.set(info.oX, info.oY, info.oZ, MathUtils.degToRad(info.theta))
	hoverOv.toQuaternion(hoverQuat)
	out.makeRotationFromQuaternion(hoverQuat)
	out.setPosition(info.x, info.y, info.z)
}

/**
 * Shared pointer handlers behind `useEntityEvents` and
 * `useInstancedEntityEvents`. `entityForEvent` maps an event to the entity it
 * targets. No invisibility handling lives here: single-entity renderers layer
 * that on in `useEntityEvents`; instanced renderers don't need it because
 * invisible instances are skipped by the instanced raycast.
 */
const createEntityEvents = (
	entityForEvent: (event: IntersectionEvent<MouseEvent>) => Entity | undefined,
	cursor: ReturnType<typeof useCursor>
) => {
	const down = new Vector2()

	const world = useWorld()

	/**
	 * A hit on a `NonSelectable` entity is treated as if the object weren't
	 * there: no cursor change, no hover or selection, and — because the handler
	 * returns before `stopPropagation` — the next intersection along the ray
	 * still receives the event, so a ghost never shadows the geometry behind it.
	 */
	const isNonSelectable = (event: IntersectionEvent<MouseEvent>) =>
		entityForEvent(event)?.has(traits.NonSelectable) ?? false

	const hoverEntity = (currentEntity: Entity, event: IntersectionEvent<MouseEvent>) => {
		const hoverInfo = updateHoverInfo(currentEntity, event)

		if (hoverInfo) {
			infoToLocalMatrix(hoverInfo, tempHoverMatrix)
			const worldMatrix = currentEntity.get(traits.WorldMatrix)
			const composed = new Matrix4()
			if (worldMatrix) {
				composed.copy(worldMatrix).multiply(tempHoverMatrix)
			} else {
				composed.copy(tempHoverMatrix)
			}
			// An instanced renderer can drop `Hovered` without dropping
			// `InstancedMatrix` (see the invisibility handling in `writeAppearance`),
			// so this has to overwrite a leftover matrix rather than skip it.
			setOrAddTrait(currentEntity, traits.InstancedMatrix, {
				matrix: composed,
				index: hoverInfo.index,
			})
		}
		currentEntity.add(traits.Hovered)
	}

	const onpointerenter = (event: IntersectionEvent<MouseEvent>) => {
		if (isNonSelectable(event)) return

		event.stopPropagation()
		cursor.onPointerEnter()

		const currentEntity = entityForEvent(event)

		if (currentEntity && !currentEntity.has(traits.Hovered)) {
			hoverEntity(currentEntity, event)
		}
	}

	const onpointermove = (event: IntersectionEvent<MouseEvent>) => {
		if (isNonSelectable(event)) return

		event.stopPropagation()

		const currentEntity = entityForEvent(event)

		if (!currentEntity) return

		if (currentEntity.has(traits.Hovered)) {
			const hoverInfo = updateHoverInfo(currentEntity, event)
			if (!hoverInfo) return

			infoToLocalMatrix(hoverInfo, tempHoverMatrix)

			const instanced = currentEntity.get(traits.InstancedMatrix)
			if (!instanced) return

			const worldMatrix = currentEntity.get(traits.WorldMatrix)
			if (worldMatrix) {
				instanced.matrix.copy(worldMatrix).multiply(tempHoverMatrix)
			} else {
				instanced.matrix.copy(tempHoverMatrix)
			}
			instanced.index = hoverInfo.index
			currentEntity.changed(traits.InstancedMatrix)
		} else {
			// A move can target an entity that never got an enter event — e.g.
			// an instanced renderer recycled an instance id to a new entity
			// under a motionless cursor — so promote the move to a hover.
			hoverEntity(currentEntity, event)
		}
	}

	const onpointerleave = (event: IntersectionEvent<MouseEvent>) => {
		if (isNonSelectable(event)) return

		event.stopPropagation()
		cursor.onPointerLeave()

		const currentEntity = entityForEvent(event)

		if (currentEntity?.has(traits.Hovered)) {
			currentEntity.remove(traits.Hovered)
		}
		if (currentEntity?.has(traits.InstancedMatrix)) {
			currentEntity.remove(traits.InstancedMatrix)
		}
	}

	const onpointerdown = (event: IntersectionEvent<MouseEvent>) => {
		if (isNonSelectable(event)) return

		down.copy(event.pointer)
	}

	const onclick = (event: IntersectionEvent<MouseEvent>) => {
		if (isNonSelectable(event)) return

		event.stopPropagation()

		if (down.distanceToSquared(event.pointer) >= 0.1) {
			return
		}

		const currentEntity = entityForEvent(event)
		if (!currentEntity) return

		if (event.nativeEvent.shiftKey) {
			if (currentEntity.has(traits.Selected)) {
				currentEntity.remove(traits.Selected)
			} else {
				currentEntity.add(traits.Selected)
			}
		} else {
			for (const entity of world.query(traits.Selected)) {
				if (entity !== currentEntity) {
					entity.remove(traits.Selected)
				}
			}
			if (!currentEntity.has(traits.Selected)) {
				currentEntity.add(traits.Selected)
			}
		}

		// `!== undefined`, because instance 0 is a valid hit
		const instanceId = event.instanceId ?? event.batchId
		if (instanceId !== undefined) {
			setOrAddTrait(currentEntity, traits.InstanceId, instanceId)
		}
	}

	return {
		onpointerenter,
		onpointermove,
		onpointerleave,
		onpointerdown,
		onclick,
	}
}

/**
 * Pointer handlers for a renderer that draws a single entity — every event
 * targets the closed-over entity.
 *
 * Layers invisibility on top of the shared handlers: enter/move/down/click are
 * suppressed while the entity is invisible, because raycasting still hits the
 * visible leaf mesh of `Mesh.svelte`, `GeometryModel.svelte`, or `GLTF.svelte`
 * and the scene visibility filter cannot block them.
 * `onpointerleave` is intentionally left active. The effect tears down a stale
 * Hovered/InstancedMatrix for an entity that turns invisible while hovered,
 * since the guarded handlers can no longer fire to clean it up.
 */
export const useEntityEvents = (entity: () => Entity | undefined) => {
	const cursor = useCursor()
	const invisible = useTrait(entity, traits.InheritedInvisible)
	const events = createEntityEvents(entity, cursor)

	const whenVisible =
		(handler: (event: IntersectionEvent<MouseEvent>) => void) =>
		(event: IntersectionEvent<MouseEvent>) => {
			if (invisible.current) return
			handler(event)
		}

	$effect(() => {
		if (invisible.current) {
			cursor.onPointerLeave()

			const currentEntity = entity()
			if (currentEntity?.has(traits.Hovered)) {
				currentEntity.remove(traits.Hovered)
			}

			if (currentEntity?.has(traits.InstancedMatrix)) {
				currentEntity.remove(traits.InstancedMatrix)
			}
		}
	})

	return {
		onpointerenter: whenVisible(events.onpointerenter),
		onpointermove: whenVisible(events.onpointermove),
		onpointerleave: events.onpointerleave,
		onpointerdown: whenVisible(events.onpointerdown),
		onclick: whenVisible(events.onclick),
	}
}

/**
 * Pointer handlers for an instanced renderer that draws many entities through
 * one object — `entityForEvent` maps each event back to the entity it targets
 * (typically via `event.instanceId`). Threlte keys hover identity by object
 * uuid + instance id, so enter/leave fire per instance with the id on the
 * event. No invisibility watcher: invisible instances are skipped by the
 * instanced raycast, so they never receive events.
 */
export const useInstancedEntityEvents = (
	entityForEvent: (event: IntersectionEvent<MouseEvent>) => Entity | undefined
) => {
	const cursor = useCursor()
	return createEntityEvents(entityForEvent, cursor)
}
