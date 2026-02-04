import {
	Object3D,
	BufferGeometry,
	Ray,
	Matrix4,
	Raycaster,
	Vector3,
	type Intersection,
	Box3,
	RawShaderMaterial,
} from 'three'
import type { InstancedArrows } from './InstancedArrows'

const vec3 = new Vector3()
const inverseMatrix = new Matrix4()
const localRay = new Ray()
const ray = new Ray()
const box = new Box3()
const segmentStart = new Vector3()
const segmentEnd = new Vector3()
const direction = new Vector3()
const closestPointRay = new Vector3()
const closestPointSeg = new Vector3()

function closestPointsRaySegment(
	ray: Ray,
	a: Vector3,
	b: Vector3,
	outRay: Vector3,
	outSeg: Vector3
) {
	// Ray: O + tD, t>=0. Segment: A + u(B-A), u in [0,1]
	const O = ray.origin
	const D = ray.direction // assume normalized
	const AB = direction.copy(b).sub(a)

	const a0 = 1.0 // D·D
	const b0 = D.dot(AB)
	const c0 = AB.dot(AB)

	const w0x = O.x - a.x,
		w0y = O.y - a.y,
		w0z = O.z - a.z
	const d0 = D.x * w0x + D.y * w0y + D.z * w0z
	const e0 = AB.x * w0x + AB.y * w0y + AB.z * w0z

	const denom = a0 * c0 - b0 * b0

	let t = 0.0
	let u = 0.0

	if (denom > 1e-8) {
		t = (b0 * e0 - c0 * d0) / denom
		u = (a0 * e0 - b0 * d0) / denom
	} else {
		t = 0.0
		u = c0 > 0.0 ? e0 / c0 : 0.0
	}

	if (t < 0.0) t = 0.0
	if (u < 0.0) u = 0.0
	else if (u > 1.0) u = 1.0

	outRay.copy(D).multiplyScalar(t).add(O)
	outSeg.copy(AB).multiplyScalar(u).add(a)

	return outRay.distanceToSquared(outSeg)
}

export function meshBoundsRaycast(
	this: Object3D & { geometry: BufferGeometry },
	raycaster: Raycaster,
	intersects: Intersection[]
) {
	if (this.geometry.boundingBox === null) {
		this.geometry.computeBoundingBox()
	}
	box.copy(this.geometry.boundingBox ?? box)

	if (!raycaster.ray.intersectsBox(box)) {
		return
	}

	raycaster.ray.intersectBox(box, vec3)
	const distance = vec3.distanceTo(raycaster.ray.origin)
	intersects.push({
		distance,
		point: vec3.clone(),
		object: this,
	})
}

/**
 * Currently unused. In the future will be used for click only (not mousemove) due to complexity.
 */
export function raycast(this: InstancedArrows, raycaster: Raycaster, intersects: Intersection[]) {
	// Ensure transforms are current
	this.shaftMesh.updateMatrixWorld(true)

	// Transform ray into local space of the mesh
	inverseMatrix.copy(this.shaftMesh.matrixWorld).invert()
	localRay.copy(raycaster.ray).applyMatrix4(inverseMatrix)
	localRay.direction.normalize()
	const material = this.shaftMesh.material as RawShaderMaterial
	const poseScale = material.uniforms?.poseScale?.value ?? 0.001
	const headAtOrigin = material.uniforms?.headAtOrigin?.value ?? 0.0

	// pick radius in local space (same units as rendered)
	const radius = Math.max(this.shaftRadius, this.headWidth)

	const array = this.poses.array as Float32Array
	const stride = 6

	// Optional quick coarse reject: if you maintain a global bounds box/sphere, test it here.

	let bestDistance = Infinity
	let bestPointWorld: Vector3 | null = null
	let bestInstanceId = -1

	for (let instanceId = 0; instanceId < this.count; instanceId++) {
		const i = instanceId * stride

		// origin is in mm in your data, so scale it to match render
		const ox = array[i + 0] * poseScale
		const oy = array[i + 1] * poseScale
		const oz = array[i + 2] * poseScale

		const dx = array[i + 3]
		const dy = array[i + 4]
		const dz = array[i + 5]

		segmentStart.set(ox, oy, oz)
		direction.set(dx, dy, dz)

		const dlen = direction.length()
		if (dlen > 0) direction.multiplyScalar(1 / dlen)
		else direction.set(0, 1, 0)

		// If shader shifts so the TIP is at origin, mirror it here
		if (headAtOrigin > 0.5) {
			segmentStart.addScaledVector(direction, -this.arrowLength)
		}

		segmentEnd.copy(segmentStart).addScaledVector(direction, this.arrowLength)

		const distSq = closestPointsRaySegment(
			localRay,
			segmentStart,
			segmentEnd,
			closestPointRay,
			closestPointSeg
		)

		if (distSq > radius * radius) continue

		// Param distance along the local ray
		const t = closestPointRay.clone().sub(localRay.origin).dot(localRay.direction)
		if (t < raycaster.near || t > raycaster.far) continue

		// Convert closest point back to world for intersection result
		const worldPoint = closestPointRay.clone().applyMatrix4(this.shaftMesh.matrixWorld)
		const worldDistance = raycaster.ray.origin.distanceTo(worldPoint)

		if (worldDistance < bestDistance) {
			bestDistance = worldDistance
			bestPointWorld = worldPoint
			bestInstanceId = instanceId
		}
	}

	if (bestInstanceId >= 0 && bestPointWorld) {
		intersects.push({
			distance: bestDistance,
			point: bestPointWorld,
			object: this.shaftMesh,
			instanceId: bestInstanceId,
		})
	}
}
