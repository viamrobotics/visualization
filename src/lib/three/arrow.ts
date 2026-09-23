import { BoxGeometry, type BufferGeometry, ConeGeometry } from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'

/** Total length of the geometry produced by `createArrowGeometry`, in meters. */
export const ARROW_LENGTH = 0.1

/**
 * Returns one merged geometry for an arrow (box tail + cone head).
 *
 * The arrow points along +Y with its tip at y = 0 and its base at y = -ARROW_LENGTH, so an
 * arrow placed at a point points at that point rather than away from it.
 */
export const createArrowGeometry = (): BufferGeometry => {
	const length = ARROW_LENGTH
	const headLength = length * 0.3
	const headWidth = headLength * 0.3
	const tailLength = length - headLength
	const tailWidth = 0.001

	// Tail: box translated so it spans from the base at y = -length up to the head.
	const tailGeometry = new BoxGeometry(tailWidth, tailLength, tailWidth)
	tailGeometry.translate(0, -length + tailLength * 0.5, 0)

	// Head: cone centered at origin spanning [-h/2, +h/2] in y
	const radialSegments = 3
	const headGeo = new ConeGeometry(headWidth * 0.5, headLength, radialSegments, 1, false)

	// Center the cone at y = -headLength/2 so the tip lands at y = 0.
	headGeo.translate(0, -headLength * 0.5, 0)

	const merged = mergeGeometries([tailGeometry, headGeo], true)
	tailGeometry.dispose()
	headGeo.dispose()
	merged.computeVertexNormals()
	merged.computeBoundingBox()
	merged.computeBoundingSphere()
	return merged
}
