import { type Shared, sharedNumber } from './sharedValue'

/** A size field of a box, sphere, or capsule geometry. */
export type GeometryDimension = 'x' | 'y' | 'z' | 'r' | 'l'

const DIMENSIONS: readonly GeometryDimension[] = ['x', 'y', 'z', 'r', 'l']

/**
 * Collapses a selection's geometries dimension by dimension. A dimension is present only when
 * every geometry has it, which holds for any selection that shares one geometry type.
 *
 * @param geometries One per selected entity. Never empty.
 */
export const sharedGeometryDimensions = (
	geometries: readonly (Partial<Record<GeometryDimension, number>> | undefined)[]
): Partial<Record<GeometryDimension, Shared<number>>> => {
	const dimensions: Partial<Record<GeometryDimension, Shared<number>>> = {}
	for (const key of DIMENSIONS) {
		const values = geometries.map((geometry) => geometry?.[key])
		if (values.every((value): value is number => value !== undefined)) {
			dimensions[key] = sharedNumber(values)
		}
	}
	return dimensions
}
