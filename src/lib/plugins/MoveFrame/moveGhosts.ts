import { type ConfigurableTrait, type Entity, type World } from 'koota'
import { Color, Matrix4 } from 'three'

import { relations, traits } from '$lib/ecs'

import { MOVE_GHOST_COLOR } from './moveGhostColor'
import { GhostOf } from './relations'

/**
 * Ghosting for a staged move, expressed as scene entities rather than meshes
 * of its own.
 *
 * The moved frame and everything hanging off it ride one world-space delta,
 * whether that is the camera being dragged, a gripper on the wrist, or the
 * gripper's own link shapes. Attached frames are rigid with respect to the
 * frame the gizmo drags, so previewing them is a single premultiply rather
 * than a re-solve.
 *
 * Each ghost is an entity holding a copy of its source's geometry, tinted and
 * marked `NonSelectable`. The renderers the scene already runs draw them:
 * boxes, spheres, capsules and cylinders fold into the instanced draw calls, bare frames
 * into the batched axes helpers, meshes into `Mesh.svelte`. Nothing here
 * draws, and nothing here allocates a material.
 *
 * Ghosts carry no `Name` and no `ChildOf`, so the hierarchy tree, the frame
 * system and the world-matrix system never see them.
 */

/**
 * `traits.Color` is read back through `Color.setRGB`, which does no
 * colour-space conversion, so the channels are stored in the working space
 * `new Color(hex)` produces.
 */
const ghostColor = new Color(MOVE_GHOST_COLOR)

const GHOST_OPACITY = 0.5

/** Ghost entities, keyed by the entity each one mirrors. */
export type MoveGhosts = Map<Entity, Entity>

export const createMoveGhosts = (): MoveGhosts => new Map()

const delta = new Matrix4()
const inverseCurrent = new Matrix4()

/**
 * The rigid world-space motion a staged drag represents — `target × current⁻¹`.
 * Frames attached below the moved one travel with it, so ghosting the subtree
 * is this delta applied to each descendant's world transform.
 *
 * Returns module scratch, rewritten on every call: hand it straight to
 * `syncMoveGhosts`, which reads it synchronously, and never hold it across
 * drag frames. Scratch rather than a fresh `Matrix4` because a live gizmo
 * recomputes this at frame rate.
 */
export const rigidMoveDelta = (currentWorldMatrix: Matrix4, targetWorldMatrix: Matrix4): Matrix4 =>
	delta.multiplyMatrices(targetWorldMatrix, inverseCurrent.copy(currentWorldMatrix).invert())

/** Whether the entity draws a shape of its own, rather than only a pose. */
const hasGeometry = (entity: Entity): boolean =>
	entity.has(traits.Box) ||
	entity.has(traits.Sphere) ||
	entity.has(traits.Capsule) ||
	entity.has(traits.Cylinder) ||
	entity.has(traits.BufferGeometry)

/**
 * Everything a rigid move carries with it, depth-first: the dragged frame and
 * every frame below it.
 *
 * The dragged frame's own kinematic links are the exception, skipped at the top
 * level: moving the frame re-solves the chain, so they land wherever IK puts
 * them rather than offset by the drag. Every level below is rigid, links
 * included — an attached gripper's links ride along with the gripper.
 *
 * A root with links of its own is skipped for the same reason. rdk reports such
 * a component's mount under `<name>_origin` and its end effector under the bare
 * name, and the entity sits at the mount while the gizmo drags the end effector
 * (see `useMovedFrameMatrix`). The drag delta says nothing about where the mount
 * lands, so there is no rigid transform to ghost it at.
 *
 * A root that draws nothing is skipped too: `MoveTargetGhost` already puts a
 * triad on the staged pose, and a second one would sit exactly on top of it.
 */
const collectMoved = (world: World, root: Entity, out: Entity[]): Entity[] => {
	let hasLinks = false

	for (const child of world.query(relations.ChildOf(root), traits.FramesAPI)) {
		if (child.has(traits.KinematicLink)) {
			hasLinks = true
			continue
		}
		collectDescendants(world, child, out)
	}

	if (!hasLinks && hasGeometry(root)) out.push(root)

	return out
}

const collectDescendants = (world: World, entity: Entity, out: Entity[]): Entity[] => {
	out.push(entity)
	for (const child of world.query(relations.ChildOf(entity))) {
		collectDescendants(world, child, out)
	}
	return out
}

/** Which renderers a source lands in, so a shape swap can respawn the ghost. */
const shapeKind = (entity: Entity): number =>
	(entity.has(traits.Box) ? 0b00_0001 : 0) |
	(entity.has(traits.Sphere) ? 0b00_0010 : 0) |
	(entity.has(traits.Capsule) ? 0b00_0100 : 0) |
	(entity.has(traits.Cylinder) ? 0b00_1000 : 0) |
	(entity.has(traits.BufferGeometry) ? 0b01_0000 : 0) |
	(entity.has(traits.Center) ? 0b10_0000 : 0)

/** Set on a ghost's cloned geometry, naming the geometry it was cloned from. */
const GHOST_OF = 'moveGhostOf'

/**
 * `Mesh.svelte` disposes the geometry it renders when it unmounts, so a ghost
 * can't share its source's `BufferGeometry` — tearing the ghost down would
 * take the real geometry with it. The clone drops any vertex colours, which
 * would otherwise win over the ghost tint, and remembers its origin so a
 * source that swaps geometry is noticed.
 */
const cloneGeometry = (entity: Entity) => {
	const source = entity.get(traits.BufferGeometry)
	if (!source) return undefined

	const geometry = source.clone()
	geometry.deleteAttribute('color')
	geometry.userData[GHOST_OF] = source.uuid
	return geometry
}

/**
 * A display-only copy of `source`'s geometry. A frame with no geometry of
 * its own, such as a bare reference frame, ghosts as an axes triad, so the
 * pose it carries stays legible.
 */
const spawnGhost = (world: World, source: Entity): Entity => {
	const shape: ConfigurableTrait[] = []

	const box = source.get(traits.Box)
	if (box) shape.push(traits.Box(box))

	const sphere = source.get(traits.Sphere)
	if (sphere) shape.push(traits.Sphere(sphere))

	const capsule = source.get(traits.Capsule)
	if (capsule) shape.push(traits.Capsule(capsule))

	const cylinder = source.get(traits.Cylinder)
	if (cylinder) shape.push(traits.Cylinder(cylinder))

	const geometry = cloneGeometry(source)
	if (geometry) shape.push(traits.BufferGeometry(geometry))

	if (shape.length === 0) shape.push(traits.ShowAxesHelper)

	const center = source.get(traits.Center)
	if (center) shape.push(traits.Center(center))

	return world.spawn(
		GhostOf(source),
		traits.NonSelectable,
		traits.WorldMatrix(new Matrix4()),
		traits.Color({ r: ghostColor.r, g: ghostColor.g, b: ghostColor.b }),
		traits.Opacity(GHOST_OPACITY),
		...shape
	)
}

/** A geometry swap under a live ghost is rare enough to rebuild rather than patch. */
const isStale = (source: Entity, ghost: Entity): boolean =>
	shapeKind(source) !== shapeKind(ghost) ||
	source.get(traits.BufferGeometry)?.uuid !== ghost.get(traits.BufferGeometry)?.userData[GHOST_OF]

/**
 * Dimensions and the geometry's frame offset can both change mid-drag. Only
 * reached once `isStale` has confirmed the ghost carries the same traits as
 * its source.
 */
const syncShape = (source: Entity, ghost: Entity) => {
	const box = source.get(traits.Box)
	if (box) ghost.set(traits.Box, box)

	const sphere = source.get(traits.Sphere)
	if (sphere) ghost.set(traits.Sphere, sphere)

	const capsule = source.get(traits.Capsule)
	if (capsule) ghost.set(traits.Capsule, capsule)

	const cylinder = source.get(traits.Cylinder)
	if (cylinder) ghost.set(traits.Cylinder, cylinder)

	const center = source.get(traits.Center)
	if (center) ghost.set(traits.Center, center)
}

/**
 * Bring `ghosts` in line with the move staged by `delta`: spawn ghosts for
 * descendants that don't have one, drop ghosts whose source has gone (or
 * turned invisible), and write every ghost's world transform. Safe to call as
 * often as the drag updates — it only ever writes what changed.
 *
 * Passing no `root` or no `delta` clears the set, so an unstaged gizmo and a
 * closed panel take the same path.
 */
export const syncMoveGhosts = (
	world: World,
	root: Entity | undefined,
	delta: Matrix4 | undefined,
	ghosts: MoveGhosts
): void => {
	if (root === undefined || !root.isAlive() || delta === undefined) {
		clearMoveGhosts(ghosts)
		return
	}

	const live = new Set<Entity>()

	for (const source of collectMoved(world, root, [])) {
		// An invisible source ghosts as nothing at all, rather than as a shape
		// with no visible original.
		if (source.has(traits.InheritedInvisible)) continue

		const sourceMatrix = source.get(traits.WorldMatrix)
		if (!sourceMatrix) continue

		let ghost = ghosts.get(source)
		if (ghost !== undefined && (!ghost.isAlive() || isStale(source, ghost))) {
			if (ghost.isAlive()) ghost.destroy()
			ghost = undefined
		}
		if (ghost === undefined) {
			ghost = spawnGhost(world, source)
			ghosts.set(source, ghost)
		}

		live.add(source)
		syncShape(source, ghost)

		const ghostMatrix = ghost.get(traits.WorldMatrix)
		if (!ghostMatrix) continue
		ghostMatrix.multiplyMatrices(delta, sourceMatrix)
		ghost.changed(traits.WorldMatrix)
	}

	for (const [source, ghost] of ghosts) {
		if (live.has(source)) continue
		if (ghost.isAlive()) ghost.destroy()
		ghosts.delete(source)
	}
}

/** Drop every ghost. Call when the drag ends or the panel closes. */
export const clearMoveGhosts = (ghosts: MoveGhosts): void => {
	for (const ghost of ghosts.values()) {
		if (ghost.isAlive()) ghost.destroy()
	}
	ghosts.clear()
}
