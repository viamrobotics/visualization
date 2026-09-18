import { Vector3 } from 'three'
import { describe, expect, it } from 'vitest'

import { ARROW_LENGTH, createArrowGeometry } from '../arrow'

describe('createArrowGeometry', () => {
	it('puts the tip at the origin and the base one arrow length behind it along -Y', () => {
		const geometry = createArrowGeometry()
		const box = geometry.boundingBox!
		const size = box.getSize(new Vector3())

		expect(box.max.y).toBeCloseTo(0)
		expect(box.min.y).toBeCloseTo(-ARROW_LENGTH)
		expect(size.y).toBeCloseTo(ARROW_LENGTH)
	})

	it('is symmetric about the Y axis', () => {
		const box = createArrowGeometry().boundingBox!

		expect(box.min.x).toBeCloseTo(-box.max.x)
		expect(box.min.z).toBeCloseTo(-box.max.z)
	})
})
