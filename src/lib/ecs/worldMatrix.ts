import { type Entity, type World } from 'koota'
import { Matrix4 } from 'three'

import { composeLocalMatrix } from '$lib/math/transform'

import { ChildOf } from './relations'
import { EditedMatrix, LiveMatrix, Matrix, Name, WorldMatrix } from './traits'

/**
 * Compute the entity's local-to-parent transform into `out`.
 *
 * `EditedMatrix` is optional — it's present only while the user has a staged
 * edit for the frame (the editing layer owns its lifecycle). The blend picks
 * the most specific source available:
 *
 * - Staged edit over live data: `live × baseline⁻¹ × edited` (previews the
 *   edit on top of the latest kinematics).
 * - Live data, no edit: `live`.
 * - Staged edit, no live data (e.g. an offline part): `edited`.
 * - Neither: the saved-config `baseline`.
 *
 * Returns `true` after writing to `out`; returns `false` and leaves `out`
 * untouched when the entity has no matrix-shaped trait.
 */
const toLocalMatrix = (entity: Entity, out: Matrix4): boolean => {
	const matrix = entity.get(Matrix)
	const editedMatrix = entity.get(EditedMatrix)
	const liveMatrix = entity.get(LiveMatrix)

	if (liveMatrix && matrix && editedMatrix) {
		composeLocalMatrix(liveMatrix, matrix, editedMatrix, out)
		return true
	}

	if (liveMatrix) {
		out.copy(liveMatrix)
		return true
	}

	if (editedMatrix) {
		out.copy(editedMatrix)
		return true
	}

	if (matrix) {
		out.copy(matrix)
		return true
	}

	return false
}

/**
 * Synchronously compute and write `WorldMatrix` for every entity in `dirty`
 * and every descendant via `ChildOf`. Memoizes per-entity world matrices in
 * `cache` so siblings reuse a parent's result. Caller passes a fresh `cache`
 * map and `inProgress` set per flush.
 *
 * `inProgress` is the cycle guard: if the parent walk revisits an entity
 * whose computation hasn't finished, we treat that branch as if it had no
 * parent rather than recursing forever. `resolveOrphans` already prevents
 * the only known way to introduce a `ChildOf` cycle; this is here so a
 * future bug downgrades to a soft visual glitch instead of a hard crash.
 */
const recomputeWorldMatrix = (
	world: World,
	entity: Entity,
	cache: Map<Entity, Matrix4>,
	inProgress: Set<Entity>
): Matrix4 | undefined => {
	if (!entity.isAlive()) return undefined

	const cached = cache.get(entity)
	if (cached) return cached

	if (inProgress.has(entity)) {
		console.warn('[worldMatrix] ChildOf cycle detected at entity', entity.get(Name) ?? entity)
		return undefined
	}
	inProgress.add(entity)

	// Reuse the entity's existing `WorldMatrix` storage when present so a
	// flush doesn't allocate a throwaway matrix per entity. First-time
	// entities get a fresh `Matrix4` that's added as the trait below.
	const out = entity.get(WorldMatrix) ?? new Matrix4()
	const hasLocal = toLocalMatrix(entity, out)
	if (!hasLocal) out.identity()

	const parent = entity.targetFor(ChildOf)
	if (parent && parent.isAlive()) {
		const parentWorld = recomputeWorldMatrix(world, parent, cache, inProgress)
		if (parentWorld) out.premultiply(parentWorld)
	}

	inProgress.delete(entity)
	cache.set(entity, out)
	return out
}

const flushDirty = (world: World, dirty: Set<Entity>) => {
	if (dirty.size === 0) return

	const cache = new Map<Entity, Matrix4>()
	const inProgress = new Set<Entity>()
	const expanded = new Set<Entity>()

	const collect = (entity: Entity) => {
		if (expanded.has(entity)) return
		expanded.add(entity)
		for (const child of world.query(ChildOf(entity))) {
			collect(child)
		}
	}

	for (const entity of dirty) collect(entity)
	dirty.clear()

	for (const entity of expanded) {
		if (!entity.isAlive()) continue
		const worldMat = recomputeWorldMatrix(world, entity, cache, inProgress)
		if (!worldMat) continue
		if (entity.has(WorldMatrix)) {
			entity.changed(WorldMatrix)
		} else {
			entity.add(WorldMatrix(worldMat))
		}
	}
}

/**
 * Wire up listeners that maintain `WorldMatrix` reactively. Subscribes to
 * add/change/remove on `Matrix`, `EditedMatrix`, `LiveMatrix`, and `ChildOf`;
 * enqueues affected entities and flushes on the next microtask.
 *
 * Returns an unsubscribe function. Plain function (not a rune hook) so tests
 * can drive the lifecycle without mounting Svelte.
 */
export const installWorldMatrixListeners = (world: World): (() => void) => {
	const dirty = new Set<Entity>()
	let scheduled = false

	const enqueue = (entity: Entity) => {
		dirty.add(entity)
		if (scheduled) return
		scheduled = true
		queueMicrotask(() => {
			scheduled = false
			flushDirty(world, dirty)
		})
	}

	for (const entity of world.query(Matrix)) enqueue(entity)
	for (const entity of world.query(EditedMatrix)) enqueue(entity)
	for (const entity of world.query(LiveMatrix)) enqueue(entity)

	const unsubs = [
		world.onAdd(Matrix, enqueue),
		world.onChange(Matrix, enqueue),
		world.onRemove(Matrix, enqueue),
		world.onAdd(EditedMatrix, enqueue),
		world.onChange(EditedMatrix, enqueue),
		world.onRemove(EditedMatrix, enqueue),
		world.onAdd(LiveMatrix, enqueue),
		world.onChange(LiveMatrix, enqueue),
		world.onRemove(LiveMatrix, enqueue),
		world.onAdd(ChildOf, enqueue),
		world.onChange(ChildOf, enqueue),
		world.onRemove(ChildOf, enqueue),
	]

	return () => {
		for (const unsub of unsubs) unsub()
	}
}
