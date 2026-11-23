import { createWorld } from 'koota'
import { Euler, Matrix4, Quaternion, Vector3 } from 'three'
import { describe, expect, it } from 'vitest'

import { relations } from '#lib/ecs/index.js'

import { centroidOf, dragDelta, outermostEntities } from '../groupTransform'

const QUARTER_TURN = Math.PI / 2

const placedAt = (x: number, y: number, z: number) => new Matrix4().makeTranslation(x, y, z)

describe('outermostEntities', () => {
	it('drops a selected entity whose grandparent is also selected, since moving the grandparent carries it', () => {
		const world = createWorld()
		const root = world.spawn()
		const middle = world.spawn(relations.ChildOf(root))
		const leaf = world.spawn(relations.ChildOf(middle))
		const unrelated = world.spawn()

		expect(outermostEntities([leaf, root, unrelated])).toEqual([root, unrelated])
	})
})

describe('centroidOf', () => {
	it('averages the translations', () => {
		const centroid = centroidOf([placedAt(0, 0, 0), placedAt(2, 4, 6)], new Vector3())

		expect(centroid.toArray()).toEqual([1, 2, 3])
	})
})

describe('dragDelta', () => {
	it('orbits another object about the pivot and turns it by the gizmo’s rotation', () => {
		const pivotStart = placedAt(0, 0, 0)
		const pivotNow = new Matrix4().makeRotationZ(QUARTER_TURN)
		const otherStart = placedAt(1, 0, 0)

		const otherNow = new Matrix4().multiplyMatrices(
			dragDelta(pivotStart, pivotNow, new Matrix4()),
			otherStart
		)

		const position = new Vector3()
		const orientation = new Quaternion()
		otherNow.decompose(position, orientation, new Vector3())
		const yaw = new Euler().setFromQuaternion(orientation).z
		expect(position.x).toBeCloseTo(0, 6)
		expect(position.y).toBeCloseTo(1, 6)
		expect(yaw).toBeCloseTo(QUARTER_TURN, 6)
	})

	it('carries another object by the gizmo’s translation', () => {
		const otherNow = new Matrix4().multiplyMatrices(
			dragDelta(placedAt(5, 0, 0), placedAt(5, 3, 0), new Matrix4()),
			placedAt(1, 1, 1)
		)

		expect(new Vector3().setFromMatrixPosition(otherNow).toArray()).toEqual([1, 4, 1])
	})
})
