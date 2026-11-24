import type { Entity } from 'koota'

import type { PartComponent } from '#lib/hooks/usePartConfig.svelte.js'

import { obstacleGeometriesOf } from '#lib/obstacleAttributes.js'
import { type ObstacleGeometryPatch, patchObstacleGeometries } from '#lib/obstacleGeometryList.js'
import { SHAPES_IN_PLACE } from '#lib/obstacleVisualizer.js'

import type { ObstacleShapesEdit } from './useObstacleShapeWrites'

/** A selected Complex obstacle shape: its own frame entity, its obstacle, and its place there. */
export interface SelectedObstacleShape {
	entity: Entity
	component: PartComponent
	index: number
}

/** The selected shapes of one obstacle. */
export interface ObstacleShapeGroup {
	component: PartComponent
	/** Places in the obstacle's `attributes.geometries`, in selection order. */
	indices: number[]
}

/** The selected shapes grouped by obstacle, so each obstacle is edited in one write. */
export const groupShapesByObstacle = (
	shapes: readonly SelectedObstacleShape[]
): ObstacleShapeGroup[] => {
	const groups = new Map<string, ObstacleShapeGroup>()
	for (const { component, index } of shapes) {
		const group = groups.get(component.name) ?? { component, indices: [] }
		group.indices.push(index)
		groups.set(component.name, group)
	}
	return [...groups.values()]
}

/** One edit per obstacle that applies `patches[i]` to `shapes[i]`, leaving every shape in place. */
export const shapePatchEdits = (
	shapes: readonly SelectedObstacleShape[],
	patches: readonly ObstacleGeometryPatch[]
): ObstacleShapesEdit[] => {
	const byObstacle = new Map<
		string,
		{ component: PartComponent; patches: Map<number, ObstacleGeometryPatch> }
	>()
	for (const [position, { component, index }] of shapes.entries()) {
		const patch = patches[position]
		if (!patch) continue

		const group = byObstacle.get(component.name) ?? { component, patches: new Map() }
		group.patches.set(index, patch)
		byObstacle.set(component.name, group)
	}

	return [...byObstacle.values()].map(({ component, patches: shapePatches }) => ({
		component,
		next: patchObstacleGeometries(obstacleGeometriesOf(component), shapePatches),
		move: SHAPES_IN_PLACE,
	}))
}
