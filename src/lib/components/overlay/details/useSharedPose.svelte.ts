import type { Entity } from 'koota'

import { relations, traits, useMappedEntitiesTraits } from '#lib/ecs/index.js'
import { Pose } from '#lib/math/index.js'

import { composeDisplayedPose } from './composeDisplayedPose'
import { MIXED_POSE, type SharedPose, sharedPose } from './sharedPose'
import { type MIXED, sharedValue } from './sharedValue'

/**
 * The pose a selection shares: each entity's local pose, the world pose they have in common, and
 * the parent they have in common. A value they differ on is `MIXED`, shown as a dash.
 */
export const useSharedPose = (
	entities: () => readonly Entity[]
): {
	/** Each entity's local pose, in the order of `entities`. */
	readonly localPoses: Pose[]
	/** Undefined when no entity has a world transform yet. */
	readonly worldPose: SharedPose | undefined
	/** Each entity's parent name, in the order of `entities`. */
	readonly parentNames: string[]
	readonly parentName: string | typeof MIXED
	/** Undefined at the world root, and while an `Orphan` waits for its parent to appear. */
	readonly parentEntity: Entity | undefined | typeof MIXED
} => {
	const reads = useMappedEntitiesTraits(
		entities,
		[
			traits.Name,
			traits.Matrix,
			traits.EditedMatrix,
			traits.WorldMatrix,
			traits.Center,
			traits.FramesAPI,
			traits.Orphan,
			relations.ChildOf,
		],
		(entity) => {
			// A frame's displayed pose is its origin. Other entities fold their geometry center in.
			const center = entity.has(traits.FramesAPI) ? undefined : entity.get(traits.Center)
			const worldMatrix = entity.get(traits.WorldMatrix)
			const parent = entity.targetFor(relations.ChildOf)

			return {
				// An entity with neither a transform nor a center renders at the origin, so that is its pose.
				localPose:
					composeDisplayedPose(
						entity.get(traits.EditedMatrix) ?? entity.get(traits.Matrix),
						center
					) ?? new Pose(),
				worldPose: worldMatrix ? composeDisplayedPose(worldMatrix, center) : undefined,
				parent: parent?.isAlive() ? parent : undefined,
				orphan: entity.get(traits.Orphan) || undefined,
			}
		}
	)

	// A parent's own rename changes what shows, so parents are read on their own.
	const parentEntities = $derived([
		...new Set(reads.current.flatMap((read) => (read.parent ? [read.parent] : []))),
	])
	const parentEntityNames = useMappedEntitiesTraits(
		() => parentEntities,
		[traits.Name],
		(parent) => parent.get(traits.Name)
	)
	const nameOfParent = $derived(
		new Map(parentEntities.map((parent, index) => [parent, parentEntityNames.current[index]]))
	)

	const parentNames = $derived(
		reads.current.map(
			(read) => (read.parent ? nameOfParent.get(read.parent) : undefined) || read.orphan || 'world'
		)
	)
	const parentName = $derived(sharedValue(parentNames))
	const parentEntity = $derived(sharedValue(reads.current.map((read) => read.parent)))

	const localPoses = $derived(reads.current.map((read) => read.localPose))
	const worldPoses = $derived(reads.current.map((read) => read.worldPose))
	const definedWorldPoses = $derived(worldPoses.filter((pose) => pose !== undefined))
	// An entity whose world transform hasn't resolved, such as an orphan, isn't drawn at the
	// origin, so it has no world pose to share. One alone keeps reading as the origin.
	const worldPose = $derived.by((): SharedPose | undefined => {
		if (definedWorldPoses.length === 0) return undefined
		if (definedWorldPoses.length < worldPoses.length) return MIXED_POSE
		return sharedPose(definedWorldPoses)
	})

	return {
		get localPoses() {
			return localPoses
		},
		get worldPose() {
			return worldPose
		},
		get parentNames() {
			return parentNames
		},
		get parentName() {
			return parentName
		},
		get parentEntity() {
			return parentEntity
		},
	}
}
