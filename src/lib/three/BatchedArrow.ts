import type { OBB } from 'three/addons/math/OBB.js'

import { BatchedMesh, Box3, Color, MeshBasicMaterial, Object3D, Vector3 } from 'three'

import { createArrowGeometry } from './arrow'

const black = new Color('black')
const axis = new Vector3()
const object3d = new Object3D()
const box1 = new Box3()
const col = new Color()

let index = 0

export class BatchedArrow {
	mesh: BatchedMesh

	_geometryId: number
	_pool: number[] = []
	_ids = new Set<number>()
	_max = 20_000

	constructor() {
		const material = new MeshBasicMaterial({ color: 0xffffff, toneMapped: false })
		const geometry = createArrowGeometry()
		const vertexCount = geometry.getAttribute('position').count
		const indexCount = geometry.index?.count ?? vertexCount

		this.mesh = new BatchedMesh(this._max, vertexCount, indexCount, material)
		this.mesh.name = `Batched arrows ${++index}`
		this.mesh.frustumCulled = false
		this._geometryId = this.mesh.addGeometry(geometry)
	}

	addArrow(direction: Vector3, origin: Vector3, color = black) {
		if (this.mesh.instanceCount >= this._max) {
			this._max += 20_000
			this.mesh.setInstanceCount(this._max)
		}

		const instanceId = this._pool.pop() ?? this.mesh.addInstance(this._geometryId)

		this._ids.add(instanceId)
		this.updateArrow(instanceId, origin, direction, color)

		return instanceId
	}

	removeArrow(instanceId: number) {
		this._ids.delete(instanceId)
		this.mesh.setVisibleAt(instanceId, false)
		this._pool.push(instanceId)
	}

	clear() {
		for (const id of this._ids) {
			this.removeArrow(id)
		}
	}

	getBoundingBoxAt(instanceId: number, target: OBB) {
		const box = this.mesh.getBoundingBoxAt(instanceId, box1)
		if (box) {
			target.fromBox3(box)
		}
		return target
	}

	updateArrow(instanceId: number, origin: Vector3, direction: Vector3, color?: Color) {
		direction.normalize()

		object3d.position.copy(origin)
		if (direction.y > 0.99999) return object3d.quaternion.set(0, 0, 0, 1)
		if (direction.y < -0.99999) return object3d.quaternion.set(1, 0, 0, 0)

		axis.set(direction.z, 0, -direction.x).normalize()
		const radians = Math.acos(direction.y)
		object3d.quaternion.setFromAxisAngle(axis, radians)

		object3d.updateMatrix()
		this.mesh.setMatrixAt(instanceId, object3d.matrix)

		if (color) {
			col.set(color)
			this.mesh.setColorAt(instanceId, col)
		}

		this.mesh.setVisibleAt(instanceId, true)
	}
}
