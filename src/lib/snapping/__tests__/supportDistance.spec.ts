import { Box3, BoxGeometry, Matrix4, Quaternion, Vector3 } from 'three'
import { describe, expect, it } from 'vitest'

import { supportDistance } from '../supportDistance'
import { box, placed } from './__fixtures__/snapFixtures'

const DOWN = new Vector3(0, 0, -1)
const tiltedAboutX = (radians: number) =>
	placed(0, 0, 0, new Quaternion().setFromAxisAngle(new Vector3(1, 0, 0), radians))

describe('supportDistance', () => {
	it('reaches a level box down by half its height', () => {
		expect(supportDistance(box(2, 4, 6), new Matrix4(), DOWN)).toBeCloseTo(3)
	})

	it('reaches a box rolled 45° down to its lowest edge', () => {
		expect(supportDistance(box(2, 2, 2), tiltedAboutX(Math.PI / 4), DOWN)).toBeCloseTo(Math.SQRT2)
	})

	it('reaches a sphere by its radius in every direction', () => {
		expect(supportDistance({ kind: 'sphere', radius: 0.3 }, tiltedAboutX(1), DOWN)).toBe(0.3)
	})

	it('reaches a standing capsule down to its tip, and a lying one by its radius', () => {
		const capsule = { kind: 'capsule', radius: 0.5, length: 4 } as const

		expect(supportDistance(capsule, new Matrix4(), DOWN)).toBeCloseTo(2)
		expect(supportDistance(capsule, tiltedAboutX(Math.PI / 2), DOWN)).toBeCloseTo(0.5)
	})

	it('reaches a lying cylinder by its radius', () => {
		const cylinder = { kind: 'cylinder', radius: 0.5, length: 4 } as const

		expect(supportDistance(cylinder, new Matrix4(), DOWN)).toBeCloseTo(2)
		expect(supportDistance(cylinder, tiltedAboutX(Math.PI / 2), DOWN)).toBeCloseTo(0.5)
	})

	it('counts a mesh whose bounds sit above its origin as reaching up, not down', () => {
		const geometry = new BoxGeometry(2, 2, 2).translate(0, 0, 3)
		geometry.computeBoundingBox()
		const bounds = geometry.boundingBox ?? new Box3()

		expect(supportDistance({ kind: 'mesh', geometry, bounds }, new Matrix4(), DOWN)).toBeCloseTo(-2)
	})
})
