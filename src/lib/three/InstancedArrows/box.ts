import { RawShaderMaterial, Box3, BufferGeometry } from 'three'
import type { InstancedArrows } from './InstancedArrows'

const bounds = new Box3()

export function computeBoundingBox(this: InstancedArrows, geometry: BufferGeometry) {
	const src = this.poses.array

	const poseScale =
		(this.shaftMesh.material as RawShaderMaterial).uniforms.poseScale?.value ?? 0.001

	const headAtOrigin =
		(this.shaftMesh.material as RawShaderMaterial).uniforms.headAtOrigin?.value ?? 1

	const r = Math.max(this.shaftRadius, this.headWidth)

	let minX = +Infinity
	let minY = +Infinity
	let minZ = +Infinity
	let maxX = -Infinity
	let maxY = -Infinity
	let maxZ = -Infinity

	for (let i = 0, l = src.length; i < l; i += 6) {
		// origin in rendered units
		const ox = src[i + 0] * poseScale
		const oy = src[i + 1] * poseScale
		const oz = src[i + 2] * poseScale

		// normalize direction
		let dx = src[i + 3]
		let dy = src[i + 4]
		let dz = src[i + 5]
		const dLen = Math.hypot(dx, dy, dz)
		if (dLen > 0) {
			const inv = 1 / dLen
			dx *= inv
			dy *= inv
			dz *= inv
		} else {
			dx = 0
			dy = 1
			dz = 0
		}

		// segment endpoints
		let ax: number, ay: number, az: number
		let bx: number, by: number, bz: number

		if (headAtOrigin > 0.5) {
			// origin is tip
			bx = ox
			by = oy
			bz = oz
			ax = ox - dx * this.arrowLength
			ay = oy - dy * this.arrowLength
			az = oz - dz * this.arrowLength
		} else {
			// origin is tail
			ax = ox
			ay = oy
			az = oz
			bx = ox + dx * this.arrowLength
			by = oy + dy * this.arrowLength
			bz = oz + dz * this.arrowLength
		}

		// expand with both endpoints
		if (ax < minX) minX = ax
		if (ay < minY) minY = ay
		if (az < minZ) minZ = az
		if (ax > maxX) maxX = ax
		if (ay > maxY) maxY = ay
		if (az > maxZ) maxZ = az

		if (bx < minX) minX = bx
		if (by < minY) minY = by
		if (bz < minZ) minZ = bz
		if (bx > maxX) maxX = bx
		if (by > maxY) maxY = by
		if (bz > maxZ) maxZ = bz
	}

	// pad by radius so the box contains arrow thickness
	minX -= r
	minY -= r
	minZ -= r
	maxX += r
	maxY += r
	maxZ += r

	bounds.min.set(minX, minY, minZ)
	bounds.max.set(maxX, maxY, maxZ)

	geometry.boundingBox = bounds.clone()
}
