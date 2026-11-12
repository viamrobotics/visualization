import { Quaternion, Vector3 } from 'three'
import { describe, expect, it } from 'vitest'

import { alignUpToNormal } from '../alignUpToNormal'
import { isVisibleTurn } from '../isVisibleTurn'

const UP = new Vector3(0, 0, 1)
const headings = Array.from({ length: 2000 }, (_, index) =>
	new Quaternion().setFromAxisAngle(UP, (index / 2000) * Math.PI * 2)
)

describe('isVisibleTurn', () => {
	it('ignores the rounding left by aligning a level object to the ground at any heading', () => {
		const turnedHeadings = headings.filter((heading) =>
			isVisibleTurn(heading, alignUpToNormal(heading, UP, new Quaternion()))
		)

		expect(turnedHeadings).toEqual([])
	})

	it('counts a one-degree tilt as a turn', () => {
		const tilt = new Quaternion().setFromAxisAngle(new Vector3(1, 0, 0), Math.PI / 180)

		expect(isVisibleTurn(new Quaternion(), tilt)).toBe(true)
	})
})
