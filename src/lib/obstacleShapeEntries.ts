import type { PartComponent } from '$lib/hooks/usePartConfig.svelte'

import { internalFrameName } from '$lib/kinematicsFrames'
import {
	isObstacleComponent,
	obstacleGeometriesOf,
	obstacleGeometryLabel,
} from '$lib/obstacleAttributes'
import { obstacleEditorType } from '$lib/obstacleEditorType'

/** Where a shape frame's geometry lives: its obstacle, and its place in `attributes.geometries`. */
export interface ObstacleShapeEntry {
	owner: string
	index: number
	/** A Complex obstacle's shapes are edited one at a time. Any other obstacle moves as a whole. */
	isComplex: boolean
}

/**
 * Every part-owned obstacle's shapes, keyed by the `<name>:<label>` frame each one is drawn
 * as. A label repeated within one obstacle keeps its first entry, as the derivation does.
 */
export const obstacleShapeEntries = (
	components: PartComponent[] | undefined
): Map<string, ObstacleShapeEntry> => {
	const entries = new Map<string, ObstacleShapeEntry>()

	for (const component of components ?? []) {
		if (!isObstacleComponent(component)) continue

		const isComplex = obstacleEditorType(component) === 'complex'
		for (const [index, geometry] of obstacleGeometriesOf(component).entries()) {
			const frameName = internalFrameName(component.name, obstacleGeometryLabel(geometry, index))
			if (!entries.has(frameName)) {
				entries.set(frameName, { owner: component.name, index, isComplex })
			}
		}
	}

	return entries
}
