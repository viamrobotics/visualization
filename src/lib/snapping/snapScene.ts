import type { Entity, World } from 'koota'

import { Matrix4 } from 'three'

import { composeMeshMatrix } from '$lib/components/Entities/composeMeshMatrix'
import { relations, traits } from '$lib/ecs'

import type { DraggedGeometry, SnapTarget } from './snapQuery'

import { type SnapShape, snapShapeOf } from './snapShape'

/** A geometry the drag can snap to. Its pose is read fresh on every pointer move. */
export interface SnapTargetEntity {
	entity: Entity
	shape: SnapShape
}

/** What a translate drag snaps with and against, gathered once when the drag starts. */
export interface SnapScene {
	targets: SnapTargetEntity[]
	dragged: DraggedGeometry[]
}

const collectSubtree = (world: World, root: Entity, out: Set<Entity>): Set<Entity> => {
	out.add(root)
	for (const child of world.query(relations.ChildOf(root))) collectSubtree(world, child, out)
	return out
}

/**
 * Splits the world's geometries for a drag of `dragged`. The entity and its descendants move
 * together, so their geometries are what snaps. Every other visible geometry is a target.
 *
 * @param anchor The gizmo anchor's world transform at drag start. Each dragged geometry is stored
 * relative to it.
 */
export const snapSceneFor = (world: World, dragged: Entity, anchor: Matrix4): SnapScene => {
	const moving = collectSubtree(world, dragged, new Set())
	const anchorInverse = new Matrix4().copy(anchor).invert()
	const scene: SnapScene = { targets: [], dragged: [] }

	for (const entity of world.query(traits.WorldMatrix)) {
		const shape = snapShapeOf(entity)
		if (!shape) continue

		if (moving.has(entity)) {
			const anchorToGeometry = new Matrix4()
			// `WorldMatrix × Center`: where every geometry kind renders, not only meshes.
			if (!composeMeshMatrix(entity, anchorToGeometry)) continue
			scene.dragged.push({ shape, anchorToGeometry: anchorToGeometry.premultiply(anchorInverse) })
			continue
		}

		if (entity.has(traits.Invisible) || entity.has(traits.InheritedInvisible)) continue
		scene.targets.push({ entity, shape })
	}

	return scene
}

/** The targets posed where they stand now. A target whose pose has gone is dropped. */
export const posedTargets = (targets: SnapTargetEntity[]): SnapTarget[] =>
	targets.flatMap(({ entity, shape }) => {
		const matrix = new Matrix4()
		return composeMeshMatrix(entity, matrix) ? [{ shape, matrix }] : []
	})
