import type { Entity, World } from 'koota'

import type { Transform } from '$lib/buf/common/v1/common_pb'
import type { Snapshot } from '$lib/buf/draw/v1/snapshot_pb'

import { traits } from '$lib/ecs'
import { reconcileSnapshotEntities, type SnapshotEntity } from '$lib/snapshot'

import { transformsToSnapshot } from '../plan-to-snapshots'
import { namespaceSnapshot } from './namespace-snapshot'
import { OBSTACLE_STYLE, type PoseSet, type PoseStyle } from './pose-sets'
import * as inspectRelations from './relations'
import { OBSTACLE_PREFIX } from './world-state-obstacles'

export interface DrawnSet {
	root: Entity
	entityMap: Map<string, SnapshotEntity>
}

// koota's `set` writes the trait's store slot but will not add an absent trait — the entity's
// mask is untouched, so `has` stays false and nothing querying the trait ever sees the value.
// Plan transforms carry no color metadata, so `Color` is always absent on spawn; `Opacity` only
// happens to be present because `drawTransform` adds it unconditionally. Guard both rather than
// depend on that.
const setOrAddColor = (entity: Entity, value: PoseStyle['rgb']) => {
	if (entity.has(traits.Color)) entity.set(traits.Color, value)
	else entity.add(traits.Color(value))
}

const setOrAddOpacity = (entity: Entity, value: number) => {
	if (entity.has(traits.Opacity)) entity.set(traits.Opacity, value)
	else entity.add(traits.Opacity(value))
}

/**
 * Spawns a set's root on its own. It has to exist before the first reconcile so `resolveOrphans` can
 * parent the set's top-level frames onto it within the same flush.
 */
export const createDrawnSet = (world: World, rootName: string): DrawnSet => ({
	root: world.spawn(traits.Name(rootName)),
	entityMap: new Map(),
})

/**
 * Draws one snapshot into an existing set, reusing the entities whose `Transform.uuid` it has seen
 * before. Stepping a set along a trajectory therefore moves the arm in place rather than respawning
 * it, since every snapshot of one path is built from the same frame descriptors.
 */
export const applySnapshot = (
	world: World,
	drawn: DrawnSet,
	snapshot: Snapshot,
	style: PoseStyle
): void => {
	// Reconcile garbage-collects only entities present in the map it is handed, so a set can never
	// sweep anything outside itself.
	const result = reconcileSnapshotEntities(world, snapshot, drawn.entityMap)

	for (const spawned of result.spawned) {
		spawned.entity.add(inspectRelations.PartOfInspection(drawn.root))

		// Frames without geometry carry `ReferenceFrame` and render as axes, which the plan colour
		// would not apply to anyway.
		if (!spawned.entity.has(traits.ReferenceFrame)) setOrAddColor(spawned.entity, style.rgb)
	}

	// Colour survives reconcile, but its metadata pass resets Opacity to the default — so opacity has
	// to be re-applied to entities that merely survived the step, not only to newly spawned ones.
	for (const entry of [...result.spawned, ...result.updated]) {
		setOrAddOpacity(entry.entity, style.opacity)
	}

	drawn.entityMap = result.current
}

const drawSnapshot = (
	world: World,
	rootName: string,
	snapshot: Snapshot,
	style: PoseStyle
): DrawnSet => {
	const drawn = createDrawnSet(world, rootName)
	applySnapshot(world, drawn, snapshot, style)
	return drawn
}

export const drawPoseSet = (world: World, poseSet: PoseSet, snapshot: Snapshot): DrawnSet =>
	drawSnapshot(world, poseSet.prefix, namespaceSnapshot(snapshot, poseSet.prefix), poseSet.style)

/**
 * Obstacles keep their `obstacle/` names and stay parented to `world` — they are the fixed scene,
 * not one of the candidate poses, so they are drawn once and survive candidate changes.
 */
export const drawObstacles = (world: World, transforms: Transform[]): DrawnSet =>
	drawSnapshot(world, OBSTACLE_PREFIX, transformsToSnapshot(transforms), OBSTACLE_STYLE)

export const destroyDrawnSet = (drawn: DrawnSet): void => {
	// `PartOfInspection` is autoDestroy: 'source', so the root takes every member with it.
	if (drawn.root.isAlive()) drawn.root.destroy()
	drawn.entityMap.clear()
}

/**
 * Toggles the root only. Every frame in a pose set is a `ChildOf` descendant of it, and
 * `useInheritedInvisible` walks that chain, so one trait hides the whole arm.
 */
export const setDrawnSetVisible = (drawn: DrawnSet, visible: boolean): void => {
	if (!drawn.root.isAlive()) return
	if (visible) drawn.root.remove(traits.Invisible)
	else drawn.root.add(traits.Invisible)
}
