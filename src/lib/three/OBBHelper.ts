import {
	Box3,
	BoxGeometry,
	BufferGeometry,
	EdgesGeometry,
	Matrix4,
	Mesh,
	Object3D,
	Vector3,
} from 'three'
import { LineMaterial } from 'three/addons/lines/LineMaterial.js'
import { LineSegments2 } from 'three/examples/jsm/lines/LineSegments2.js'
import { LineSegmentsGeometry } from 'three/examples/jsm/lines/LineSegmentsGeometry.js'

const box = new Box3()
const childBox = new Box3()
const inverseRootMatrixWorld = new Matrix4()
const rootMatrixWorld = new Matrix4()
const relativeMatrix = new Matrix4()
const scaleMatrix = new Matrix4()
const center = new Vector3()
const size = new Vector3()

const corners = [
	new Vector3(),
	new Vector3(),
	new Vector3(),
	new Vector3(),
	new Vector3(),
	new Vector3(),
	new Vector3(),
	new Vector3(),
]

const expandBoxByTransformedBox = (box: Box3, childBox: Box3, matrix: Matrix4) => {
	const min = childBox.min
	const max = childBox.max

	corners[0].set(min.x, min.y, min.z).applyMatrix4(matrix)
	corners[1].set(min.x, min.y, max.z).applyMatrix4(matrix)
	corners[2].set(min.x, max.y, min.z).applyMatrix4(matrix)
	corners[3].set(min.x, max.y, max.z).applyMatrix4(matrix)
	corners[4].set(max.x, min.y, min.z).applyMatrix4(matrix)
	corners[5].set(max.x, min.y, max.z).applyMatrix4(matrix)
	corners[6].set(max.x, max.y, min.z).applyMatrix4(matrix)
	corners[7].set(max.x, max.y, max.z).applyMatrix4(matrix)

	for (const corner of corners) {
		box.expandByPoint(corner)
	}
}

export class OBBHelper extends LineSegments2 {
	constructor(color = 0x000000, linewidth = 2) {
		const edges = new EdgesGeometry(new BoxGeometry())
		const geometry = new LineSegmentsGeometry()
		geometry.setPositions(edges.getAttribute('position').array as Float32Array)

		const material = new LineMaterial({
			color,
			linewidth,
			depthTest: false,
			depthWrite: false,
			transparent: true,
		})

		super(geometry, material)

		this.matrixAutoUpdate = false
		this.frustumCulled = false
		this.renderOrder = 999
	}

	setFromObject(root: Object3D) {
		root.updateWorldMatrix(true, true)

		rootMatrixWorld.copy(root.matrixWorld)
		inverseRootMatrixWorld.copy(rootMatrixWorld).invert()

		box.makeEmpty()

		root.traverse((child) => {
			const mesh = child as Mesh
			const geometry = mesh.geometry as BufferGeometry | undefined

			if (!geometry) return

			if (!geometry.boundingBox) {
				geometry.computeBoundingBox()
			}

			if (!geometry.boundingBox) return

			// Transform this mesh's local bounding box into root-local space
			relativeMatrix.multiplyMatrices(inverseRootMatrixWorld, mesh.matrixWorld)
			childBox.copy(geometry.boundingBox)

			expandBoxByTransformedBox(box, childBox, relativeMatrix)
		})

		if (box.isEmpty()) {
			console.warn('[OBBHelper] No geometry found on object to compute OBB.')
			return this
		}

		box.getCenter(center)
		box.getSize(size)

		// Place the helper at the center of the bounding box, in root-local space
		this.matrix.makeTranslation(center.x, center.y, center.z)

		// Then inherit the root's full world transform
		this.matrix.premultiply(rootMatrixWorld)

		// Scale the unit box to the OBB extents in root-local axes
		this.matrix.multiply(scaleMatrix.makeScale(size.x, size.y, size.z))

		this.matrixWorld.copy(this.matrix)
		return this
	}

	dispose() {
		this.geometry.dispose()
		this.material.dispose()
	}
}
