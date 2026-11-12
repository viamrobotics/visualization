import { Box3, BoxGeometry, Matrix4, Quaternion, Vector3 } from 'three'
import { describe, expect, it } from 'vitest'

import { geometryKeyPoints } from '../geometryKeyPoints'
import { box, placed } from './__fixtures__/snapFixtures'

const contains = (points: Vector3[], expected: Vector3) =>
	points.some((point) => point.distanceTo(expected) < 1e-9)

describe('geometryKeyPoints', () => {
	it('gives a box its 8 corners, 12 edge midpoints, and 6 face centres', () => {
		const points = geometryKeyPoints(box(2, 2, 2), new Matrix4())

		expect(points).toHaveLength(26)
		expect(contains(points, new Vector3(1, 1, 1))).toBe(true)
		expect(contains(points, new Vector3(1, 0, -1))).toBe(true)
		expect(contains(points, new Vector3(0, 0, 1))).toBe(true)
		expect(contains(points, new Vector3(0, 0, 0))).toBe(false)
	})

	it('turns the +Y face centre to face −X under a quarter turn about Z', () => {
		const quarterTurn = new Quaternion().setFromAxisAngle(new Vector3(0, 0, 1), Math.PI / 2)
		const points = geometryKeyPoints(box(2, 4, 2), placed(10, 0, 0, quarterTurn))

		expect(contains(points, new Vector3(8, 0, 0))).toBe(true)
	})

	it('gives a mesh the points of its bounds, wherever those sit', () => {
		const geometry = new BoxGeometry(2, 2, 2).translate(5, 0, 0)
		geometry.computeBoundingBox()
		const bounds = geometry.boundingBox ?? new Box3()

		const points = geometryKeyPoints({ kind: 'mesh', geometry, bounds }, new Matrix4())

		expect(contains(points, new Vector3(6, 1, 1))).toBe(true)
		expect(contains(points, new Vector3(4, 0, 0))).toBe(true)
	})

	it('gives a sphere its centre alone', () => {
		const points = geometryKeyPoints({ kind: 'sphere', radius: 1 }, placed(1, 2, 3))

		expect(points).toEqual([new Vector3(1, 2, 3)])
	})

	it('gives a capsule its centre and the ends of its axis', () => {
		const points = geometryKeyPoints({ kind: 'capsule', radius: 0.5, length: 4 }, new Matrix4())

		expect(points).toHaveLength(3)
		expect(contains(points, new Vector3(0, 0, 2))).toBe(true)
		expect(contains(points, new Vector3(0, 0, -2))).toBe(true)
	})
})
