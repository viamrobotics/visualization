import { Box3, BoxGeometry, Matrix4, Quaternion, Ray, Vector3 } from 'three'
import { describe, expect, it } from 'vitest'

import { raycastSnapShape } from '../raycastSnapShape'
import { box, placed } from './__fixtures__/snapFixtures'

const fromAbove = (x: number, y: number) => new Ray(new Vector3(x, y, 10), new Vector3(0, 0, -1))
const fromPlusX = (y: number, z: number) => new Ray(new Vector3(10, y, z), new Vector3(-1, 0, 0))

const expectVector = (actual: Vector3 | undefined, expected: Vector3) => {
	expect(actual?.distanceTo(expected)).toBeCloseTo(0)
}

describe('raycastSnapShape', () => {
	it('hits the top face of a box placed in the world', () => {
		const hit = raycastSnapShape(fromAbove(5.2, 0), box(2, 2, 2), placed(5, 0, 1))

		expectVector(hit?.point, new Vector3(5.2, 0, 2))
		expectVector(hit?.normal, new Vector3(0, 0, 1))
		expect(hit?.distance).toBeCloseTo(8)
	})

	it('reports the tilted normal of a rotated box', () => {
		const roll = new Quaternion().setFromAxisAngle(new Vector3(1, 0, 0), Math.PI / 6)
		const hit = raycastSnapShape(fromAbove(0, 0), box(4, 4, 2), placed(0, 0, 0, roll))

		expectVector(hit?.normal, new Vector3(0, 0, 1).applyQuaternion(roll))
	})

	it('faces a flat box back toward the ray', () => {
		const hit = raycastSnapShape(fromAbove(0.5, 0), box(2, 2, 0), new Matrix4())

		expectVector(hit?.point, new Vector3(0.5, 0, 0))
		expectVector(hit?.normal, new Vector3(0, 0, 1))
	})

	it('faces a flat box back toward every slanted ray, not where rounding lands the hit', () => {
		const slantedRays = Array.from({ length: 200 }, (_, index) => {
			const angle = (index / 200) * Math.PI * 2
			const direction = new Vector3(Math.cos(angle) * 0.3, Math.sin(angle) * 0.7, -1).normalize()
			return new Ray(new Vector3(0.1, -0.2, 0).addScaledVector(direction, -10), direction)
		})

		const downwardNormals = slantedRays
			.map((ray) => raycastSnapShape(ray, box(2, 2, 0), new Matrix4())?.normal)
			.filter((normal) => normal?.z !== 1)

		expect(downwardNormals).toEqual([])
	})

	it('misses a box the ray passes beside', () => {
		expect(raycastSnapShape(fromAbove(3, 0), box(2, 2, 2), new Matrix4())).toBeNull()
	})

	it('ignores a box behind the ray', () => {
		const ray = new Ray(new Vector3(0, 0, -5), new Vector3(0, 0, -1))

		expect(raycastSnapShape(ray, box(2, 2, 2), new Matrix4())).toBeNull()
	})

	it('hits a sphere on its curve, not its bounds', () => {
		const hit = raycastSnapShape(fromAbove(0.6, 0), { kind: 'sphere', radius: 1 }, new Matrix4())

		expectVector(hit?.point, new Vector3(0.6, 0, 0.8))
		expectVector(hit?.normal, new Vector3(0.6, 0, 0.8))
	})

	it('hits the rounded tip of a standing capsule', () => {
		const hit = raycastSnapShape(
			fromAbove(0, 0),
			{ kind: 'capsule', radius: 0.5, length: 4 },
			new Matrix4()
		)

		expectVector(hit?.point, new Vector3(0, 0, 2))
	})

	it('hits the wall of a standing capsule from the side', () => {
		const hit = raycastSnapShape(
			fromPlusX(0, 1),
			{ kind: 'capsule', radius: 0.5, length: 4 },
			new Matrix4()
		)

		expectVector(hit?.point, new Vector3(0.5, 0, 1))
		expectVector(hit?.normal, new Vector3(1, 0, 0))
	})

	it('hits the flat cap of a cylinder and its wall', () => {
		const cylinder = { kind: 'cylinder', radius: 0.5, length: 2 } as const

		const cap = raycastSnapShape(fromAbove(0.2, 0), cylinder, new Matrix4())
		expectVector(cap?.point, new Vector3(0.2, 0, 1))
		expectVector(cap?.normal, new Vector3(0, 0, 1))

		const wall = raycastSnapShape(fromPlusX(0, 0.5), cylinder, new Matrix4())
		expectVector(wall?.point, new Vector3(0.5, 0, 0.5))
		expectVector(wall?.normal, new Vector3(1, 0, 0))
	})

	it('hits a mesh triangle and reports its outward normal', () => {
		const geometry = new BoxGeometry(2, 2, 2)
		geometry.computeBoundingBox()
		const bounds = geometry.boundingBox ?? new Box3()

		const hit = raycastSnapShape(
			fromAbove(0.3, 0.3),
			{ kind: 'mesh', geometry, bounds },
			placed(0, 0, 1)
		)

		expectVector(hit?.point, new Vector3(0.3, 0.3, 2))
		expectVector(hit?.normal, new Vector3(0, 0, 1))
	})
})
