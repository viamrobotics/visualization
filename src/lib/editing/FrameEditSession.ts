import type { Pose } from '@viamrobotics/sdk'
import type { Entity } from 'koota'

import type { Frame } from '$lib/frame'

import { traits } from '$lib/ecs'
import { isFinitePose } from '$lib/transform'

export type UpdateFrameFn = (
	componentName: string,
	referenceFrame: string,
	pose: Pose,
	geometry?: Frame['geometry']
) => void

export type DeleteFrameFn = (componentName: string) => void

interface GeometrySnapshot {
	type: 'box' | 'sphere' | 'capsule' | 'none'
	box?: { x: number; y: number; z: number }
	sphere?: { r: number }
	capsule?: { r: number; l: number }
}

interface FrameSnapshot {
	name: string
	parent: string
	editedPose: Pose
	geometry: GeometrySnapshot
}

const captureGeometry = (entity: Entity): GeometrySnapshot => {
	const box = entity.get(traits.Box)
	if (box) return { type: 'box', box: { ...box } }
	const sphere = entity.get(traits.Sphere)
	if (sphere) return { type: 'sphere', sphere: { ...sphere } }
	const capsule = entity.get(traits.Capsule)
	if (capsule) return { type: 'capsule', capsule: { ...capsule } }
	return { type: 'none' }
}

const restoreGeometryTrait = (entity: Entity, snap: GeometrySnapshot): void => {
	if (snap.type === 'none') {
		entity.remove(traits.Box, traits.Sphere, traits.Capsule)
		return
	}
	if (snap.type === 'box' && snap.box) {
		entity.remove(traits.Sphere, traits.Capsule)
		if (entity.has(traits.Box)) entity.set(traits.Box, snap.box)
		else entity.add(traits.Box(snap.box))
		return
	}
	if (snap.type === 'sphere' && snap.sphere) {
		entity.remove(traits.Box, traits.Capsule)
		if (entity.has(traits.Sphere)) entity.set(traits.Sphere, snap.sphere)
		else entity.add(traits.Sphere(snap.sphere))
		return
	}
	if (snap.type === 'capsule' && snap.capsule) {
		entity.remove(traits.Box, traits.Sphere)
		if (entity.has(traits.Capsule)) entity.set(traits.Capsule, snap.capsule)
		else entity.add(traits.Capsule(snap.capsule))
	}
}

const snapshotToFrameGeometry = (snap: GeometrySnapshot): Frame['geometry'] => {
	if (snap.type === 'box' && snap.box) return { type: 'box', ...snap.box }
	if (snap.type === 'sphere' && snap.sphere) return { type: 'sphere', ...snap.sphere }
	if (snap.type === 'capsule' && snap.capsule) return { type: 'capsule', ...snap.capsule }
	return { type: 'none' }
}

const liveGeometry = (entity: Entity): Frame['geometry'] =>
	snapshotToFrameGeometry(captureGeometry(entity))

/**
 * A single user gesture against one or more frames (drag, parent change, geometry tweak).
 * Owns the affected entities until commit() or abort() runs. Snapshots their pre-gesture
 * trait state so abort() can restore — both the ECS view and the dirty part config.
 *
 * Replaces the Transforming marker trait: while a session is active, useFrames asks
 * `session.owns(entity)` instead of inspecting a per-entity flag.
 */
export class FrameEditSession {
	private snapshots = new Map<Entity, FrameSnapshot>()
	private updateFrame: UpdateFrameFn
	private deleteFrame: DeleteFrameFn
	private onClose: () => void
	#closed = false

	constructor(
		entities: Entity[],
		updateFrame: UpdateFrameFn,
		deleteFrame: DeleteFrameFn,
		onClose: () => void
	) {
		this.updateFrame = updateFrame
		this.deleteFrame = deleteFrame
		this.onClose = onClose

		for (const entity of entities) {
			const name = entity.get(traits.Name)
			const editedPose = entity.get(traits.EditedPose)
			if (!name || !editedPose) continue

			this.snapshots.set(entity, {
				name,
				parent: entity.get(traits.Parent) ?? 'world',
				editedPose: { ...editedPose },
				geometry: captureGeometry(entity),
			})
		}
	}

	get isClosed(): boolean {
		return this.#closed
	}

	owns(entity: Entity | undefined): boolean {
		return entity !== undefined && !this.#closed && this.snapshots.has(entity)
	}

	stagePose = (entity: Entity, pose: Partial<Pose>): void => {
		const snap = this.snapshots.get(entity)
		if (!snap || this.#closed) return

		const current = entity.get(traits.EditedPose)
		if (!current) return

		const next: Pose = { ...current, ...pose }
		entity.set(traits.EditedPose, next)
		this.updateFrame(snap.name, entity.get(traits.Parent) ?? 'world', next, liveGeometry(entity))
	}

	stageGeometry = (entity: Entity, geometry: Frame['geometry']): void => {
		const snap = this.snapshots.get(entity)
		if (!snap || this.#closed || !geometry) return

		if (geometry.type === 'none') {
			entity.remove(traits.Box, traits.Sphere, traits.Capsule)
		} else if (geometry.type === 'box') {
			const data = { x: geometry.x, y: geometry.y, z: geometry.z }
			restoreGeometryTrait(entity, { type: 'box', box: data })
		} else if (geometry.type === 'sphere') {
			restoreGeometryTrait(entity, { type: 'sphere', sphere: { r: geometry.r } })
		} else if (geometry.type === 'capsule') {
			restoreGeometryTrait(entity, { type: 'capsule', capsule: { r: geometry.r, l: geometry.l } })
		}

		const editedPose = entity.get(traits.EditedPose)
		if (editedPose) {
			this.updateFrame(snap.name, entity.get(traits.Parent) ?? 'world', editedPose, geometry)
		}
	}

	stageParent = (entity: Entity, parent: string): void => {
		const snap = this.snapshots.get(entity)
		if (!snap || this.#closed) return

		traits.setParentTrait(entity, parent === 'world' ? undefined : parent)

		const editedPose = entity.get(traits.EditedPose)
		if (editedPose) {
			this.updateFrame(snap.name, parent, editedPose, liveGeometry(entity))
		}
	}

	stageDelete = (entity: Entity): void => {
		const snap = this.snapshots.get(entity)
		if (!snap || this.#closed) return
		this.deleteFrame(snap.name)
	}

	/**
	 * Validate and close. Returns true on success. On invalid pose data
	 * (NaN/infinite from a degenerate gizmo state), aborts and returns false.
	 */
	commit = (): boolean => {
		if (this.#closed) return false

		for (const [entity] of this.snapshots) {
			const pose = entity.get(traits.EditedPose)
			if (pose && !isFinitePose(pose)) {
				this.abort()
				return false
			}
		}

		this.#close()
		return true
	}

	/**
	 * Restore each owned entity's traits to its pre-session state and re-issue
	 * an updateFrame so the dirty part config matches.
	 */
	abort = (): void => {
		if (this.#closed) return

		for (const [entity, snap] of this.snapshots) {
			if (entity.isAlive()) {
				entity.set(traits.EditedPose, snap.editedPose)
				traits.setParentTrait(entity, snap.parent === 'world' ? undefined : snap.parent)
				restoreGeometryTrait(entity, snap.geometry)
			}
			this.updateFrame(
				snap.name,
				snap.parent,
				snap.editedPose,
				snapshotToFrameGeometry(snap.geometry)
			)
		}

		this.#close()
	}

	#close = (): void => {
		this.#closed = true
		this.onClose()
	}
}
