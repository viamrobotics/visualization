import { type Intrinsics, isUsableIntrinsics } from '#lib/cameraIntrinsics.js'

/** Image corners as fractions of the image, wound clockwise from the top left. */
const CORNERS = [
	[0, 0],
	[1, 0],
	[1, 1],
	[0, 1],
] as const

/**
 * Endpoint pairs into the eight corners below: near ring 0-3, far ring 4-7. Both rings
 * are wound in {@link CORNERS} order, so corner `i` joins corner `i + 4`.
 */
const EDGES = [
	[0, 1],
	[1, 2],
	[2, 3],
	[3, 0],
	[4, 5],
	[5, 6],
	[6, 7],
	[7, 4],
	[0, 4],
	[1, 5],
	[2, 6],
	[3, 7],
] as const

/**
 * Wireframe line-segment endpoints for a camera's view frustum, in the camera frame's
 * own coordinates: metres, optical axis along +Z, image-down along +Y — the convention
 * `FramePovView` renders against.
 *
 * Suitable for a `LineSegments` position attribute as returned. Undefined when the
 * intrinsics cannot describe a frustum, or when the depth range is empty; the caller
 * draws nothing rather than a volume the camera does not actually see.
 *
 * @param near - Depth of the near plane, in metres. Zero collapses the near ring onto
 *   the camera origin, which draws the apex the four joining edges converge on.
 * @param far - Depth of the far plane, in metres. How far out coverage is drawn is a
 *   display choice, not a camera property — `GetProperties` reports no depth range.
 */
export const frustumPositions = (
	intrinsics: Intrinsics,
	near: number,
	far: number
): Float32Array | undefined => {
	if (!isUsableIntrinsics(intrinsics)) return undefined
	if (!Number.isFinite(near) || !Number.isFinite(far)) return undefined
	if (near < 0 || far <= near) return undefined

	const { widthPx, heightPx, focalXPx, focalYPx, centerXPx, centerYPx } = intrinsics

	const corners: [x: number, y: number, z: number][] = []
	for (const depth of [near, far]) {
		for (const [u, v] of CORNERS) {
			corners.push([
				((u * widthPx - centerXPx) / focalXPx) * depth,
				((v * heightPx - centerYPx) / focalYPx) * depth,
				depth,
			])
		}
	}

	const positions = new Float32Array(EDGES.length * 2 * 3)
	let offset = 0
	for (const edge of EDGES) {
		for (const index of edge) {
			positions.set(corners[index]!, offset)
			offset += 3
		}
	}

	return positions
}
