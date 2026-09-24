import type { Entity } from 'koota'

import type { Frame } from '$lib/frame'

import { hierarchy, traits } from '$lib/ecs'
import { Pose, type PosePatch } from '$lib/math'

export type UpdateFrameFn = (
	componentName: string,
	referenceFrame: string,
	pose: Pose,
	geometry?: Frame['geometry']
) => void

export type DeleteFrameFn = (componentName: string) => void

export type EditableFrameGeometry = NonNullable<Frame['geometry']>
type Geometry = EditableFrameGeometry
type GeometryType = Geometry['type']

const defaultGeometry = (type: GeometryType): Geometry => {
	switch (type) {
		case 'box': {
			return { type: 'box', x: 100, y: 100, z: 100 }
		}
		case 'sphere': {
			return { type: 'sphere', r: 100 }
		}
		case 'capsule': {
			return { type: 'capsule', r: 20, l: 100 }
		}
		default: {
			return { type: 'none' }
		}
	}
}

/**
 * Fill a partial geometry edit (e.g. a slider changing one capsule dimension)
 * with the frame's current dimensions so untouched fields are preserved. Returns
 * undefined when the edit carries no dimensions to apply.
 */
const resolveGeometry = (entity: Entity, geometry: Partial<Geometry>): Geometry | undefined => {
	if (geometry.type === 'none') {
		return { type: 'none' }
	}
	if (geometry.type === 'box') {
		if (geometry.x === undefined && geometry.y === undefined && geometry.z === undefined) return
		const cur = entity.get(traits.Box)
		return {
			type: 'box',
			x: geometry.x ?? cur?.x ?? 0,
			y: geometry.y ?? cur?.y ?? 0,
			z: geometry.z ?? cur?.z ?? 0,
		}
	}
	if (geometry.type === 'sphere') {
		if (geometry.r === undefined) return
		return { type: 'sphere', r: geometry.r }
	}
	if (geometry.type === 'capsule') {
		if (geometry.r === undefined && geometry.l === undefined) return
		const cur = entity.get(traits.Capsule)
		return {
			type: 'capsule',
			r: geometry.r ?? cur?.r ?? 0,
			l: geometry.l ?? cur?.l ?? 0,
		}
	}
	return
}

/** Write a resolved geometry onto the entity's geometry trait, dropping the others. */
export const applyGeometryTrait = (entity: Entity, geometry: Geometry): void => {
	if (geometry.type === 'box') {
		entity.remove(traits.Sphere, traits.Capsule)
		const value = { x: geometry.x, y: geometry.y, z: geometry.z }
		if (entity.has(traits.Box)) entity.set(traits.Box, value)
		else entity.add(traits.Box(value))
	} else if (geometry.type === 'sphere') {
		entity.remove(traits.Box, traits.Capsule)
		const value = { r: geometry.r }
		if (entity.has(traits.Sphere)) entity.set(traits.Sphere, value)
		else entity.add(traits.Sphere(value))
	} else if (geometry.type === 'capsule') {
		entity.remove(traits.Box, traits.Sphere)
		const value = { r: geometry.r, l: geometry.l }
		if (entity.has(traits.Capsule)) entity.set(traits.Capsule, value)
		else entity.add(traits.Capsule(value))
	} else {
		entity.remove(traits.Box, traits.Sphere, traits.Capsule)
	}
}

const parentName = (entity: Entity): string => hierarchy.getParentName(entity) ?? 'world'

/**
 * Applies a frame edit immediately and independently: mutates the entity's
 * traits and writes the change into the dirty part config. Every frame-editing
 * tool — the desktop gizmo, the details-panel inputs, the XR configurator —
 * builds one of these and calls it per drag/input event. There's no staged
 * gesture to commit or abort; each call stands on its own.
 *
 * Every mutator no-ops on an entity without `Editable`, so a tool that forgets
 * to check cannot write a frame that has no config entry behind it.
 */
export class FrameEditor {
	#updateFrame: UpdateFrameFn
	#deleteFrame: DeleteFrameFn
	// Per-instance scratch pose so a synchronous Koota subscriber firing on a
	// trait change can't clobber it mid-method from another FrameEditor.
	#tempPose = new Pose()

	constructor(updateFrame: UpdateFrameFn, deleteFrame: DeleteFrameFn) {
		this.#updateFrame = updateFrame
		this.#deleteFrame = deleteFrame
	}

	/**
	 * The frame's staged-edit local pose. `EditedMatrix` exists only while an edit
	 * is staged, so create it lazily from the saved baseline (`Matrix`) on first
	 * edit. Seeding from the baseline keeps the frame at its current pose until the
	 * caller writes an actual change.
	 */
	#stagedMatrix = (entity: Entity) => {
		const existing = entity.get(traits.EditedMatrix)
		if (existing) return existing

		const baseline = entity.get(traits.Matrix)
		if (!baseline) return undefined

		entity.add(traits.EditedMatrix(baseline.clone()))
		return entity.get(traits.EditedMatrix)
	}

	/** Merge a partial local pose (position and/or orientation) into the frame. */
	setPose = (entity: Entity, pose: PosePatch): void => {
		if (!entity.has(traits.Editable)) return

		const name = entity.get(traits.Name)
		const matrix = this.#stagedMatrix(entity)
		if (!name || !matrix) return

		this.#tempPose.setFromMatrix4(matrix)

		const next = this.#tempPose.clone().merge(pose)

		// Guard against a degenerate gizmo solve producing NaN/∞ — leave the frame
		// at its last good pose rather than writing garbage into the config.
		if (!next.isFinite()) return

		next.toMatrix4(matrix)
		entity.changed(traits.EditedMatrix)
		this.#updateFrame(name, parentName(entity), next)
	}

	/** Merge partial geometry dimensions into the frame's current geometry. */
	setGeometry = (entity: Entity, geometry: Partial<Geometry>): void => {
		const resolved = resolveGeometry(entity, geometry)
		if (resolved) this.#writeGeometry(entity, resolved)
	}

	/** Replace the frame's geometry with a default of the given type. */
	setGeometryType = (entity: Entity, type: GeometryType): void => {
		this.#writeGeometry(entity, defaultGeometry(type))
	}

	#writeGeometry = (entity: Entity, geometry: Geometry): void => {
		if (!entity.has(traits.Editable)) return

		const name = entity.get(traits.Name)
		const matrix = this.#stagedMatrix(entity)
		if (!name || !matrix) return

		applyGeometryTrait(entity, geometry)
		this.#tempPose.setFromMatrix4(matrix)
		this.#updateFrame(name, parentName(entity), this.#tempPose.clone(), geometry)
	}

	setParent = (entity: Entity, parent: string): void => {
		if (!entity.has(traits.Editable)) return

		const name = entity.get(traits.Name)
		const matrix = this.#stagedMatrix(entity)
		if (!name || !matrix) return

		hierarchy.setParent(entity, parent === 'world' ? undefined : parent)
		this.#tempPose.setFromMatrix4(matrix)
		this.#updateFrame(name, parent, this.#tempPose.clone())
	}

	deleteFrame = (entity: Entity): void => {
		if (!entity.has(traits.Editable)) return

		const name = entity.get(traits.Name)
		if (name) this.#deleteFrame(name)
	}
}
