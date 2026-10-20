import { Quaternion, Vector3 } from 'three'
import { describe, expect, it } from 'vitest'

import { OrientationVector } from '$lib/math/OrientationVector'

import { upAxisOrientation } from '../upAxisOrientation'

const apply = (up: 'x' | 'y' | 'z', v: Vector3): Vector3 => {
	const { oX, oY, oZ, theta } = upAxisOrientation(up)
	const quaternion = new OrientationVector(oX, oY, oZ, (theta * Math.PI) / 180).toQuaternion(
		new Quaternion()
	)
	return v.clone().applyQuaternion(quaternion)
}

describe('upAxisOrientation', () => {
	it("maps +Y to +Z for 'y'", () => {
		const out = apply('y', new Vector3(0, 1, 0))
		expect(out.x).toBeCloseTo(0, 9)
		expect(out.y).toBeCloseTo(0, 9)
		expect(out.z).toBeCloseTo(1, 9)
	})

	it("maps +X to +Z for 'x'", () => {
		const out = apply('x', new Vector3(1, 0, 0))
		expect(out.x).toBeCloseTo(0, 9)
		expect(out.y).toBeCloseTo(0, 9)
		expect(out.z).toBeCloseTo(1, 9)
	})

	it("is the identity for 'z'", () => {
		expect(upAxisOrientation('z')).toEqual({ oX: 0, oY: 0, oZ: 1, theta: 0 })
		const out = apply('z', new Vector3(0.3, -0.4, 0.5))
		expect(out.toArray()).toEqual([0.3, -0.4, 0.5])
	})
})
