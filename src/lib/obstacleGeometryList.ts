import { defaultFrameGeometry } from '#lib/defaultFrameGeometry.js'
import {
	explicitGeometryLabel,
	type ObstacleGeometryConfig,
	obstacleGeometryLabel,
} from '#lib/obstacleAttributes.js'
import { nextCopyName } from '#lib/obstacleCopyName.js'

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

/**
 * Appends a copy of the entry at `index`, labeled `<name>-copy` after what rdk calls the entry, and
 * returns that label. Appending keeps every unlabeled `geometry_N` after the source at its number.
 * An index out of range leaves the contents unchanged and returns no label.
 */
export const duplicateObstacleGeometry = (
	geometries: ObstacleGeometryConfig[],
	index: number
): { geometries: ObstacleGeometryConfig[]; label: string | undefined } => {
	const source = geometries[index]
	if (!source) return { geometries, label: undefined }

	const label = nextCopyName(
		geometries.map((geometry) => explicitGeometryLabel(geometry)),
		obstacleGeometryLabel(source, index)
	)
	// rdk also reads a capitalized `Label`. The copy carries its label under the one spelling this app writes.
	const copy: Record<string, unknown> = { ...source, label }
	delete copy.Label
	return { geometries: [...geometries, copy as ObstacleGeometryConfig], label }
}

/**
 * Appends a copy of each entry in `indices`, in the order given, and returns their labels. A later
 * copy's label skips the earlier copies', so two copies of one entry never share a label.
 */
export const duplicateObstacleGeometries = (
	geometries: ObstacleGeometryConfig[],
	indices: readonly number[]
): { geometries: ObstacleGeometryConfig[]; labels: string[] } => {
	let next = geometries
	const labels: string[] = []
	for (const index of indices) {
		const result = duplicateObstacleGeometry(next, index)
		next = result.geometries
		if (result.label !== undefined) labels.push(result.label)
	}
	return { geometries: next, labels }
}

/** Removes the entry at `index`. An index out of range leaves the contents unchanged. */
export const removeObstacleGeometry = (
	geometries: ObstacleGeometryConfig[],
	index: number
): ObstacleGeometryConfig[] => geometries.filter((_geometry, position) => position !== index)

/** Removes every entry in `indices`. An index out of range is ignored. */
export const removeObstacleGeometries = (
	geometries: ObstacleGeometryConfig[],
	indices: ReadonlySet<number>
): ObstacleGeometryConfig[] => geometries.filter((_geometry, position) => !indices.has(position))

/** Applies each patch to the entry at its index, as `patchObstacleGeometry` does for one. */
export const patchObstacleGeometries = (
	geometries: ObstacleGeometryConfig[],
	patches: ReadonlyMap<number, ObstacleGeometryPatch>
): ObstacleGeometryConfig[] => {
	let next = geometries
	for (const [index, patch] of patches) next = patchObstacleGeometry(next, index, patch)
	return next
}

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
