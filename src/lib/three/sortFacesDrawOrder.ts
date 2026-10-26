import { type BatchedMesh, Vector4 } from 'three'

/** `@types/three` leaves out `index`, the instance id three stamps on every range. */
interface DrawRange {
	start: number
	count: number
	z: number
	index: number
}

const color = new Vector4()

/**
 * Custom sort for the faces batch: opaque instances first, in instance-id order, then
 * translucent ones back to front.
 *
 * The faces material is always `transparent`, so three's default would sort every
 * instance back to front by its bounding-sphere centre. Opaque surfaces that share
 * triangles, such as a zone cut from its part's mesh, tie in the depth test, the later
 * draw wins, and the centre sort flips which is later as the camera orbits. Opaque
 * instances need no blending order, so id order settles those ties the same way from
 * every angle: the entity spawned later draws on top.
 *
 * Freed ids are reused lowest first, so id order tracks spawn order until an entity is
 * released and its slot taken by a newer one.
 */
export function sortFacesDrawOrder(
	this: BatchedMesh,
	list: { start: number; count: number; z: number }[]
): void {
	const ranges = list as DrawRange[]
	const opaque: DrawRange[] = []
	const translucent: DrawRange[] = []

	for (const range of ranges) {
		const target = this.getColorAt(range.index, color).w < 1 ? translucent : opaque
		target.push(range)
	}

	opaque.sort((a, b) => a.index - b.index)
	translucent.sort((a, b) => b.z - a.z)

	ranges.splice(0, ranges.length, ...opaque, ...translucent)
}
