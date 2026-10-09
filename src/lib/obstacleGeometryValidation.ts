import { explicitGeometryLabel, type ObstacleGeometryConfig } from '$lib/obstacleAttributes'

/**
 * A problem rdk's config validation would reject. `index` pins it to an entry, and
 * is undefined for a problem with the list as a whole.
 */
export interface ObstacleGeometryIssue {
	index: number | undefined
	message: string
}

const RESERVED_LABEL = 'world'
const LABEL_SEPARATOR = ':'
const CAPSULE_LENGTH_PER_RADIUS = 2

const shapeProblem = (geometry: ObstacleGeometryConfig): string | undefined => {
	switch (geometry.type) {
		case 'box': {
			if (geometry.x < 0 || geometry.y < 0 || geometry.z < 0) {
				return 'A box dimension cannot be negative.'
			}
			return undefined
		}
		case 'sphere': {
			return geometry.r > 0 ? undefined : 'A sphere radius must be greater than zero.'
		}
		case 'capsule': {
			if (!(geometry.r > 0)) return 'A capsule radius must be greater than zero.'
			if (!(geometry.l > 0)) return 'A capsule length must be greater than zero.'
			if (geometry.l < CAPSULE_LENGTH_PER_RADIUS * geometry.r) {
				return 'A capsule length must be at least twice its radius.'
			}
			return undefined
		}
		default: {
			return undefined
		}
	}
}

const labelProblem = (label: string, seenLabels: Set<string>): string | undefined => {
	if (label === '') return undefined
	if (label === RESERVED_LABEL) return `The label "${RESERVED_LABEL}" is reserved.`
	if (label.includes(LABEL_SEPARATOR)) return `A label cannot contain "${LABEL_SEPARATOR}".`
	if (seenLabels.has(label)) return `The label "${label}" is used more than once.`
	return undefined
}

/**
 * The problems rdk's obstacle validation would reject `geometries` for, so they
 * surface before a save. An empty list of issues means rdk accepts them.
 */
export const validateObstacleGeometries = (
	geometries: ObstacleGeometryConfig[]
): ObstacleGeometryIssue[] => {
	if (geometries.length === 0) {
		return [{ index: undefined, message: 'An obstacle needs at least one geometry.' }]
	}
	const issues: ObstacleGeometryIssue[] = []
	const seenLabels = new Set<string>()
	for (const [index, geometry] of geometries.entries()) {
		const label = explicitGeometryLabel(geometry)
		const message = shapeProblem(geometry) ?? labelProblem(label, seenLabels)
		if (message) issues.push({ index, message })
		if (label !== '') seenLabels.add(label)
	}
	return issues
}
