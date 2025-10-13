import {
	LineSegments,
	LineBasicMaterial,
	EdgesGeometry,
	BoxGeometry,
	Vector3,
	Quaternion,
	Matrix4,
	Object3D,
	Mesh,
	BufferGeometry,
	Matrix3,
} from 'three'

const center = new Vector3()
const half = new Vector3()
const size = new Vector3()
const quaternion = new Quaternion()
const scale = new Vector3()
const absScale = new Vector3()
const worldCenter = new Vector3()

export class OBBHelper extends LineSegments {
	constructor(color = 0x000000, linewidth = 1) {
		const geometry = new EdgesGeometry(new BoxGeometry())
		const material = new LineBasicMaterial({ color, linewidth })

		super(geometry, material)

		this.matrixAutoUpdate = false
		this.frustumCulled = false
	}

	setFromOBB(obb: { center: Vector3; halfSize: Vector3; rotation: { elements: number[] } }) {
		// position/rotation
		const basis = new Matrix4().setFromMatrix3(obb.rotation as Matrix3)
		quaternion.setFromRotationMatrix(basis)

		// scale = full size
		size.copy(obb.halfSize).multiplyScalar(2)

		// compose
		this.matrix.compose(obb.center, quaternion, size)
		this.matrixWorld.copy(this.matrix) // no parent updates if used standalone
		return this
	}

	/** Set from a Mesh/Object3D assuming no shears. Uses geometry's local bbox + world rotation/scale. */
	setFromObject(object: Object3D) {
		// Find a geometry to read bbox from
		let geometry: BufferGeometry | undefined

		if ((object as Mesh).geometry) {
			geometry = (object as Mesh).geometry
		} else {
			// try the first mesh child
			object.traverse((child) => {
				if (!geometry && (child as Mesh).geometry) {
					geometry = (child as Mesh).geometry
				}
			})
		}

		if (!geometry) {
			console.warn('[OBBHelper] No geometry found on object to compute OBB.')
			return this
		}

		if (!geometry.boundingBox) {
			geometry.computeBoundingBox()
		}

		if (geometry.boundingBox) {
			geometry.boundingBox.getCenter(center)

			// half size in local space
			geometry.boundingBox.getSize(size).multiplyScalar(0.5)
		}

		object.getWorldQuaternion(quaternion)
		object.getWorldScale(scale)

		// non-uniform scale supported (no shear): enlarge halfSize by |scale|
		half.copy(size).multiply(absScale.set(Math.abs(scale.x), Math.abs(scale.y), Math.abs(scale.z)))

		worldCenter.copy(center)
		object.localToWorld(worldCenter)

		// compose transform (unit box -> oriented box)
		const fullSize = half.multiplyScalar(2)
		this.matrix.compose(worldCenter, quaternion, fullSize)
		this.matrixWorld.copy(this.matrix)
		return this
	}

	dispose() {
		this.geometry.dispose()
		;(this.material as LineBasicMaterial).dispose()
	}
}
