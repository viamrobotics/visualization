import { defaultFrameGeometry } from '$lib/defaultFrameGeometry'
import {
	explicitGeometryLabel,
	type ObstacleGeometryConfig,
	obstacleGeometryLabel,
} from '$lib/obstacleAttributes'

/** The fields of a geometry an edit can set. A key passed as `undefined` is removed. */
export type ObstacleGeometryPatch = Partial<ObstacleGeometryConfig>

const SHAPE_FIELDS = ['x', 'y', 'z', 'r', 'l'] as const
const FIRST_SHAPE_NUMBER = 1

/** The first of `<prefix>-1`, `<prefix>-2`, … that no entry's label uses. */
const freeLabel = (geometries: ObstacleGeometryConfig[], prefix: string): string => {
	const takenLabels = new Set(geometries.map((geometry) => explicitGeometryLabel(geometry)))
	let number = FIRST_SHAPE_NUMBER
	while (takenLabels.has(`${prefix}-${number}`)) {
		number += 1
	}
	return `${prefix}-${number}`
}

/** Appends a default box with a fresh `shape-N` label, and returns that label. */
export const addObstacleGeometry = (
	geometries: ObstacleGeometryConfig[]
): { geometries: ObstacleGeometryConfig[]; label: string } => {
	const label = freeLabel(geometries, 'shape')
	const added = { label, ...defaultFrameGeometry('box') } as ObstacleGeometryConfig
	return { geometries: [...geometries, added], label }
}

/**
 * Appends a copy of the entry at `index` labeled `<name>-N`, where the name is what rdk calls
 * the entry and N is the first number free, and returns that label. An index out of range
 * leaves the contents unchanged and returns no label.
 */
export const duplicateObstacleGeometry = (
	geometries: ObstacleGeometryConfig[],
	index: number
): { geometries: ObstacleGeometryConfig[]; label: string | undefined } => {
	const source = geometries[index]
	if (!source) return { geometries, label: undefined }

	const label = freeLabel(geometries, obstacleGeometryLabel(source, index))
	// rdk also reads a `Label` key. The copy carries its label under the one spelling this app writes.
	const copy: Record<string, unknown> = { ...source, label }
	delete copy.Label
	return { geometries: [...geometries, copy as ObstacleGeometryConfig], label }
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
