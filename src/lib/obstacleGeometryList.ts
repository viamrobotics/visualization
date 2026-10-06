import type { ObstacleGeometryConfig } from '$lib/obstacleAttributes'

import { defaultFrameGeometry } from '$lib/defaultFrameGeometry'

/** The fields of a geometry an edit can set. A key passed as `undefined` is removed. */
export type ObstacleGeometryPatch = Partial<ObstacleGeometryConfig>

const SHAPE_FIELDS = ['x', 'y', 'z', 'r', 'l'] as const
const FIRST_SHAPE_NUMBER = 1

/** Appends a default box with a fresh `shape-N` label, and returns that label. */
export const addObstacleGeometry = (
	geometries: ObstacleGeometryConfig[]
): { geometries: ObstacleGeometryConfig[]; label: string } => {
	const takenLabels = new Set(geometries.map((geometry) => geometry.label))
	let shapeNumber = FIRST_SHAPE_NUMBER
	while (takenLabels.has(`shape-${shapeNumber}`)) {
		shapeNumber += 1
	}
	const label = `shape-${shapeNumber}`
	const added = { label, ...defaultFrameGeometry('box') } as ObstacleGeometryConfig
	return { geometries: [...geometries, added], label }
}

/** Removes the entry at `index`. An index out of range leaves the contents unchanged. */
export const removeObstacleGeometry = (
	geometries: ObstacleGeometryConfig[],
	index: number
): ObstacleGeometryConfig[] => geometries.filter((_geometry, position) => position !== index)

/**
 * Applies `patch` to the entry at `index`. A patch carrying `type` replaces the
 * shape fields, keeping only the label and offset.
 */
export const patchObstacleGeometry = (
	geometries: ObstacleGeometryConfig[],
	index: number,
	patch: ObstacleGeometryPatch
): ObstacleGeometryConfig[] =>
	geometries.map((geometry, position) => {
		if (position !== index) return geometry
		const merged: Record<string, unknown> = { ...geometry }
		if ('type' in patch) {
			for (const field of SHAPE_FIELDS) delete merged[field]
		}
		for (const [key, value] of Object.entries(patch)) {
			if (value === undefined) {
				delete merged[key]
			} else {
				merged[key] = value
			}
		}
		return merged as ObstacleGeometryConfig
	})
