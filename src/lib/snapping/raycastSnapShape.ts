import { Box3, type BufferGeometry, DoubleSide, Matrix4, Plane, Ray, Sphere, Vector3 } from 'three'
import { MeshBVH } from 'three-mesh-bvh'

import type { SnapShape } from './snapShape'

/** Where a ray meets a geometry's surface, in world space. */
export interface SnapHit {
	point: Vector3
	/** The outward surface normal at `point`, unit length. */
	normal: Vector3
	/** Distance from the ray's origin to `point`. */
	distance: number
}

/** The nearest hit found so far on one shape, in the shape's local frame. */
interface LocalHit {
	distance: number
	point: Vector3
	normal: Vector3
}

const inverse = new Matrix4()
const localRay = new Ray()
const candidate = new Vector3()
const offset = new Vector3()
const scratchBox = new Box3()
const scratchSphere = new Sphere()
const capPlane = new Plane()

// Built on first hit-test and kept with the geometry. `indirect` leaves the rendered geometry's
// index untouched, since a BVH otherwise reorders it.
const meshBvhs = new WeakMap<BufferGeometry, MeshBVH>()

const bvhFor = (geometry: BufferGeometry): MeshBVH => {
	let bvh = meshBvhs.get(geometry)
	if (!bvh) {
		bvh = new MeshBVH(geometry, { indirect: true })
		meshBvhs.set(geometry, bvh)
	}
	return bvh
}

/**
 * Records `candidate` as the hit when it lies ahead of the ray and nearer than the current one.
 * Returns whether it was recorded, so the caller knows to set the normal.
 */
const recordIfNearer = (ray: Ray, hit: LocalHit): boolean => {
	const distance = offset.copy(candidate).sub(ray.origin).dot(ray.direction)
	if (distance < 0 || distance >= hit.distance) return false

	hit.distance = distance
	hit.point.copy(candidate)
	return true
}

const hitBox = (ray: Ray, halfSize: Vector3, hit: LocalHit) => {
	scratchBox.min.copy(halfSize).negate()
	scratchBox.max.copy(halfSize)
	if (!ray.intersectBox(scratchBox, candidate) || !recordIfNearer(ray, hit)) return

	// The face is the axis where the hit sits furthest out, relative to the box's size there.
	const x = Math.abs(candidate.x) / halfSize.x
	const y = Math.abs(candidate.y) / halfSize.y
	const z = Math.abs(candidate.z) / halfSize.z
	if (x >= y && x >= z) hit.normal.set(Math.sign(candidate.x), 0, 0)
	else if (y >= z) hit.normal.set(0, Math.sign(candidate.y), 0)
	else hit.normal.set(0, 0, Math.sign(candidate.z))
}

/** A sphere centred on the local +Z axis at `centerZ`. */
const hitSphere = (ray: Ray, centerZ: number, radius: number, hit: LocalHit) => {
	scratchSphere.center.set(0, 0, centerZ)
	scratchSphere.radius = radius
	if (!ray.intersectSphere(scratchSphere, candidate) || !recordIfNearer(ray, hit)) return

	hit.normal.copy(candidate).sub(scratchSphere.center).normalize()
}

/** The side wall of a cylinder about +Z, between `±halfLength`. */
const hitCylinderWall = (ray: Ray, radius: number, halfLength: number, hit: LocalHit) => {
	const { origin, direction } = ray
	const a = direction.x * direction.x + direction.y * direction.y
	// A ray parallel to the axis never crosses the wall.
	if (a < Number.EPSILON) return

	const b = 2 * (origin.x * direction.x + origin.y * direction.y)
	const c = origin.x * origin.x + origin.y * origin.y - radius * radius
	const discriminant = b * b - 4 * a * c
	if (discriminant < 0) return

	ray.at((-b - Math.sqrt(discriminant)) / (2 * a), candidate)
	if (Math.abs(candidate.z) > halfLength || !recordIfNearer(ray, hit)) return

	hit.normal.set(candidate.x, candidate.y, 0).normalize()
}

/** A flat disc at `capZ`, facing away from the cylinder's centre. */
const hitCylinderCap = (ray: Ray, radius: number, capZ: number, hit: LocalHit) => {
	capPlane.normal.set(0, 0, Math.sign(capZ))
	capPlane.constant = -Math.abs(capZ)
	if (!ray.intersectPlane(capPlane, candidate)) return
	if (candidate.x * candidate.x + candidate.y * candidate.y > radius * radius) return
	if (!recordIfNearer(ray, hit)) return

	hit.normal.copy(capPlane.normal)
}

const hitMesh = (ray: Ray, geometry: BufferGeometry, hit: LocalHit) => {
	const intersection = bvhFor(geometry).raycastFirst(ray, DoubleSide)
	if (!intersection?.face) return

	candidate.copy(intersection.point)
	if (!recordIfNearer(ray, hit)) return

	hit.normal.copy(intersection.face.normal)
	// A double-sided hit can land on a back face, whose stored normal points along the ray.
	if (hit.normal.dot(ray.direction) > 0) hit.normal.negate()
}

const hitShape = (ray: Ray, shape: SnapShape, hit: LocalHit) => {
	switch (shape.kind) {
		case 'box': {
			hitBox(ray, shape.halfSize, hit)
			return
		}
		case 'sphere': {
			hitSphere(ray, 0, shape.radius, hit)
			return
		}
		case 'capsule': {
			const segmentHalfLength = Math.max(0, shape.length / 2 - shape.radius)
			hitCylinderWall(ray, shape.radius, segmentHalfLength, hit)
			hitSphere(ray, segmentHalfLength, shape.radius, hit)
			hitSphere(ray, -segmentHalfLength, shape.radius, hit)
			return
		}
		case 'cylinder': {
			const halfLength = shape.length / 2
			hitCylinderWall(ray, shape.radius, halfLength, hit)
			hitCylinderCap(ray, shape.radius, halfLength, hit)
			hitCylinderCap(ray, shape.radius, -halfLength, hit)
			return
		}
		case 'mesh': {
			hitMesh(ray, shape.geometry, hit)
			return
		}
		default: {
			shape satisfies never
		}
	}
}

/**
 * Where a world-space ray first meets a geometry's surface, or `null` when it misses.
 *
 * @param matrix The geometry's local-to-world transform, without scale.
 */
export const raycastSnapShape = (ray: Ray, shape: SnapShape, matrix: Matrix4): SnapHit | null => {
	localRay.copy(ray).applyMatrix4(inverse.copy(matrix).invert())
	localRay.direction.normalize()

	const hit: LocalHit = { distance: Infinity, point: new Vector3(), normal: new Vector3() }
	hitShape(localRay, shape, hit)
	if (hit.distance === Infinity) return null

	const point = hit.point.applyMatrix4(matrix)
	const normal = hit.normal.transformDirection(matrix)
	return { point, normal, distance: point.distanceTo(ray.origin) }
}
