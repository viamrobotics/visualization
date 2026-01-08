import { type BufferGeometry, BoxGeometry, ConeGeometry } from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'

/**
 * Returns one merged geometry for an arrow (box tail + cone head)
 *
 * Arrow points along +Y with its base at y = 0
 */
export const createArrowGeometry = (): BufferGeometry => {
	const length = 0.1
	const headLength = length * 0.3
	const headWidth = headLength * 0.3
	const tailLength = length - headLength
	const tailWidth = 0.001

	// Tail: box translated so base starts at y = 0
	const tailGeometry = new BoxGeometry(tailWidth, tailLength, tailWidth)
	tailGeometry.translate(0, tailLength * 0.5, 0)

	// Head: cone centered at origin spanning [-h/2, +h/2] in y
	const radialSegments = 3
	const headGeo = new ConeGeometry(headWidth * 0.5, headLength, radialSegments, 1, false)

	// Place its center at y = shaftLength + headLength/2 so tip lands at y = shaftLength + headLength
	headGeo.translate(0, tailLength + headLength * 0.5, 0)

	const merged = mergeGeometries([tailGeometry, headGeo], true)
	merged.computeVertexNormals()
	merged.computeBoundingBox()
	merged.computeBoundingSphere()
	return merged
}
