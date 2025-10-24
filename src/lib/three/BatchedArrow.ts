import {
	BatchedMesh,
	BoxGeometry,
	ConeGeometry,
	MeshBasicMaterial,
	Object3D,
	Vector3,
	Color,
	Box3,
	Matrix4,
	Group,
	type Material,
} from 'three'
import type { OBB } from 'three/addons/math/OBB.js'

const black = new Color('black')

const axis = new Vector3()
const object3d = new Object3D()
const vec3 = new Vector3()
const box1 = new Box3()
const box2 = new Box3()
const box3 = new Box3()
const mat4_1 = new Matrix4()
const mat4_2 = new Matrix4()
const col = new Color()

interface Arrow {
	shaftId: number
	headId: number
	batchIndex: number
}

let index = 0

export class BatchedArrow {
	private _batches: BatchedMesh[] = []
	private _shaftGeoIds: number[] = []
	private _coneGeoIds: number[] = []

	private readonly _maxArrowsPerBatch: number
	private readonly _material: Material

	private readonly _object3d = new Group()

	private readonly _arrows = new Map<number, Arrow>() // arrowId -> { shaftId, headId, batchIndex }
	private readonly _idToArrowId = new Map<string, number>() // "batchIndex:instanceId" -> arrowId
	private readonly _pool: Arrow[] = []
	private _idCounter = 0

	shaftWidth = 0

	constructor({
		maxArrows = 20_000,
		shaftWidth = 0.001,
		material = new MeshBasicMaterial({ color: 0xffffff, toneMapped: false }),
	} = {}) {
		this._maxArrowsPerBatch = maxArrows
		this._material = material
		this.shaftWidth = shaftWidth

		this._object3d.name = `batched arrows container ${++index}`

		this._addNewBatch()
	}

	private _addNewBatch() {
		const shaftGeo = new BoxGeometry(1, 1, 1)
		shaftGeo.translate(0, 0.5, 0)

		const coneGeo = new ConeGeometry(0.5, 1, 8, 1)
		coneGeo.translate(0, -0.5, 0)

		const shaftVertexCount = shaftGeo.getAttribute('position').count
		const coneVertexCount = coneGeo.getAttribute('position').count
		const shaftIndexCount = shaftGeo.index?.count ?? shaftVertexCount
		const coneIndexCount = coneGeo.index?.count ?? coneVertexCount

		const maxVertexCount = this._maxArrowsPerBatch * (shaftVertexCount + coneVertexCount)
		const maxIndexCount = this._maxArrowsPerBatch * (shaftIndexCount + coneIndexCount)

		const batchedMesh = new BatchedMesh(
			this._maxArrowsPerBatch * 2,
			maxVertexCount,
			maxIndexCount,
			this._material
		)
		batchedMesh.name = `batched arrows batch ${this._batches.length}`
		batchedMesh.frustumCulled = false

		this._shaftGeoIds.push(batchedMesh.addGeometry(shaftGeo))
		this._coneGeoIds.push(batchedMesh.addGeometry(coneGeo))

		this._batches.push(batchedMesh)
		this._object3d.add(batchedMesh)
	}

	addArrow(
		direction: Vector3,
		origin: Vector3,
		length = 0.1,
		color = black,
		arrowHeadAtPose = true
	) {
		const instance = this._pool.pop()
		if (instance) {
			const { shaftId, headId, batchIndex } = instance
			this._drawArrow(
				shaftId,
				headId,
				direction,
				origin,
				length,
				color,
				arrowHeadAtPose,
				batchIndex
			)
			const arrowId = this._idCounter++
			this._arrows.set(arrowId, instance)
			this._idToArrowId.set(`${batchIndex}:${shaftId}`, arrowId)
			this._idToArrowId.set(`${batchIndex}:${headId}`, arrowId)
			return arrowId
		}

		let activeBatchIndex = this._batches.length - 1
		let activeBatch = this._batches[activeBatchIndex]
		let shaftId = activeBatch.addInstance(this._shaftGeoIds[activeBatchIndex])
		if (shaftId === -1) {
			this._addNewBatch()
			activeBatchIndex = this._batches.length - 1
			activeBatch = this._batches[activeBatchIndex]
			shaftId = activeBatch.addInstance(this._shaftGeoIds[activeBatchIndex])
		}

		const headId = activeBatch.addInstance(this._coneGeoIds[activeBatchIndex])
		this._drawArrow(
			shaftId,
			headId,
			direction,
			origin,
			length,
			color,
			arrowHeadAtPose,
			activeBatchIndex
		)

		const arrowId = this._idCounter++
		this._arrows.set(arrowId, { shaftId, headId, batchIndex: activeBatchIndex })
		this._idToArrowId.set(`${activeBatchIndex}:${shaftId}`, arrowId)
		this._idToArrowId.set(`${activeBatchIndex}:${headId}`, arrowId)
		return arrowId
	}

	getArrowId(batchIndex: number, instanceId: number) {
		return this._idToArrowId.get(`${batchIndex}:${instanceId}`)
	}

	getBatches() {
		return this._batches
	}

	getBoundingBoxAt(arrowId: number, target: OBB) {
		const arrow = this._arrows.get(arrowId)

		if (arrow) {
			const batch = this._batches[arrow.batchIndex]
			const coneGeoId = this._coneGeoIds[arrow.batchIndex]
			const shaftGeoId = this._shaftGeoIds[arrow.batchIndex]
			const headBox = batch.getBoundingBoxAt(coneGeoId, box1)
			const tailBox = batch.getBoundingBoxAt(shaftGeoId, box2)

			if (headBox && tailBox) {
				batch.getMatrixAt(arrow.headId, mat4_1)
				batch.getMatrixAt(arrow.shaftId, mat4_2)
				box3.copy(headBox.applyMatrix4(mat4_1)).union(tailBox.applyMatrix4(mat4_2))
				target.fromBox3(box3)

				return target
			}
		}
	}

	removeArrow(arrowId: number) {
		const arrow = this._arrows.get(arrowId)
		if (!arrow) return
		const batch = this._batches[arrow.batchIndex]
		batch.setVisibleAt(arrow.shaftId, false)
		batch.setVisibleAt(arrow.headId, false)
		this._pool.push(arrow)
		this._arrows.delete(arrowId)
		this._idToArrowId.delete(`${arrow.batchIndex}:${arrow.shaftId}`)
		this._idToArrowId.delete(`${arrow.batchIndex}:${arrow.headId}`)
	}

	updateArrow(
		arrowId: number,
		direction: Vector3,
		origin: Vector3,
		length = 0.1,
		color = black,
		arrowHeadAtPose = true
	) {
		const arrow = this._arrows.get(arrowId)
		if (!arrow) return
		this._drawArrow(
			arrow.shaftId,
			arrow.headId,
			direction,
			origin,
			length,
			color,
			arrowHeadAtPose,
			arrow.batchIndex
		)
	}

	clear() {
		for (const id of this._arrows.keys()) {
			this.removeArrow(id)
		}
	}

	getObject3d(batchIndex: number, instanceId: number) {
		const batch = this._batches[batchIndex]
		if (!batch) return undefined
		batch.getMatrixAt(instanceId, object3d.matrix)
		object3d.updateMatrix()
		return object3d
	}

	_drawArrow(
		shaftId: number,
		headId: number,
		direction: Vector3,
		origin: Vector3,
		length: number,
		color: Color,
		arrowHeadAtPose: boolean,
		batchIndex: number
	) {
		if (arrowHeadAtPose) {
			// Compute the base position so the arrow ends at the origin
			origin.sub(vec3.copy(direction).multiplyScalar(length))
		}

		direction.normalize()

		const headLength = length * 0.2
		const headWidth = headLength * 0.2

		// Apply shaft transform
		const shaftMatrix = this._computeTransform(
			origin,
			direction,
			length - headLength,
			this.shaftWidth
		)
		const batch = this._batches[batchIndex]
		batch.setMatrixAt(shaftId, shaftMatrix)

		// Compute cone position = origin + dir * length
		const coneOrigin = vec3.copy(direction).multiplyScalar(length).add(origin)
		const coneMatrix = this._computeTransform(coneOrigin, direction, headLength, headWidth * 4)
		batch.setMatrixAt(headId, coneMatrix)

		if (color) {
			col.set(color)
			batch.setColorAt(shaftId, col)
			batch.setColorAt(headId, col)
		}

		batch.setVisibleAt(shaftId, true)
		batch.setVisibleAt(headId, true)
	}

	_computeTransform(origin: Vector3, dir: Vector3, lengthY: number, scaleXZ = 1) {
		object3d.position.copy(origin)
		object3d.quaternion.copy(this._quaternionFromDirection(dir))
		object3d.scale.set(scaleXZ, lengthY, scaleXZ)
		object3d.updateMatrix()
		return object3d.matrix.clone()
	}

	_quaternionFromDirection(dir: Vector3) {
		if (dir.y > 0.99999) return object3d.quaternion.set(0, 0, 0, 1)
		if (dir.y < -0.99999) return object3d.quaternion.set(1, 0, 0, 0)

		axis.set(dir.z, 0, -dir.x).normalize()
		const radians = Math.acos(dir.y)
		return object3d.quaternion.setFromAxisAngle(axis, radians)
	}

	get object3d() {
		return this._object3d
	}
}
