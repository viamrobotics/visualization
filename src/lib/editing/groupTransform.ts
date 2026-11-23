import type { Entity } from 'koota'
import type { Matrix4 } from 'three'

import { Vector3 } from 'three'

import { relations } from '#lib/ecs/index.js'

const tempPosition = new Vector3()

/**
 * The entities the gizmo moves: every selected entity with no selected ancestor. Moving
 * an ancestor already carries its descendants, so moving them too would move them twice.
 */
export const outermostEntities = (entities: readonly Entity[]): Entity[] => {
	const selected = new Set(entities)

	return entities.filter((entity) => {
		for (
			let ancestor = entity.targetFor(relations.ChildOf);
			ancestor;
			ancestor = ancestor.targetFor(relations.ChildOf)
		) {
			if (selected.has(ancestor)) return false
		}
		return true
	})
}

/** Writes the mean of each matrix's translation into `out`, in metres. */
export const centroidOf = (matrices: readonly Matrix4[], out: Vector3): Vector3 => {
	out.set(0, 0, 0)
	if (matrices.length === 0) return out

	for (const matrix of matrices) out.add(tempPosition.setFromMatrixPosition(matrix))
	return out.divideScalar(matrices.length)
}

/**
 * Writes the world transform a drag has applied so far, `current · start⁻¹`, into `out`.
 * Left-multiplying an entity's world transform at drag start by it moves the entity
 * the way the gizmo moved: carried along by a translate, orbited about the gizmo by a rotate.
 */
export const dragDelta = (start: Matrix4, current: Matrix4, out: Matrix4): Matrix4 =>
	out.copy(start).invert().premultiply(current)
