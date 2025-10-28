import { type BufferGeometry, BoxGeometry, ConeGeometry } from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'

/** Returns ONE merged geometry for an arrow (box shaft + cone head).
 *  Arrow points along +Y with its base at y = 0.
 */
export function createArrowGeometry(): BufferGeometry {
	const length = 0.1
	const headLength = length * 0.2
	const headWidth = headLength * 0.3
	const tailLength = length - headLength
	const tailWidth = 0.001

	// --- Shaft: unit box centered at origin; translate so base starts at y=0
	const shaftGeo = new BoxGeometry(tailWidth, tailLength, tailWidth)
	shaftGeo.translate(0, tailLength * 0.5, 0)

	// --- Head: cone centered at origin spanning [-h/2, +h/2] in Y
	// Make radius = headWidth/2, height = headLength
	const radialSegments = 5
	const headGeo = new ConeGeometry(headWidth * 0.5, headLength, radialSegments, 1, false)
	// Place its center at y = shaftLength + headLength/2 so tip lands at y = shaftLength + headLength
	headGeo.translate(0, tailLength + headLength * 0.5, 0)

	// --- Merge into one BufferGeometry
	const merged = mergeGeometries([shaftGeo, headGeo], true)
	merged.computeVertexNormals()
	merged.computeBoundingBox()
	merged.computeBoundingSphere()
	return merged
}
