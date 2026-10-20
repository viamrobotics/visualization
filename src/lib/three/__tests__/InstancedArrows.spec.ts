import { describe, expect, it } from 'vitest'

import { InstancedArrows } from '../InstancedArrows/InstancedArrows'

const TWO_ARROWS = new Float32Array([0, 0, 0, 0, 0, 1, 0.1, 0, 0, 0, 0, 1])

const instanceColors = (arrows: InstancedArrows) => [
	...(arrows.attributes.instanceColor.array as Uint8Array),
]

describe('InstancedArrows.update', () => {
	it('writes a color per arrow', () => {
		const arrows = new InstancedArrows({ count: 2 })

		arrows.update({ poses: TWO_ARROWS, colors: new Uint8Array([1, 2, 3, 4, 5, 6]) })

		expect(instanceColors(arrows)).toStrictEqual([1, 2, 3, 4, 5, 6])
	})

	// The draw service accepts any colors buffer, so a caller can send more colors
	// than arrows. Throwing here would abort the koota onAdd that spawns the
	// entity, leaving it in the world but unregistered and impossible to remove.
	it('drops colors past the last arrow instead of throwing', () => {
		const arrows = new InstancedArrows({ count: 2 })

		expect(() =>
			arrows.update({ poses: TWO_ARROWS, colors: new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9]) })
		).not.toThrow()
		expect(instanceColors(arrows)).toStrictEqual([1, 2, 3, 4, 5, 6])
	})

	it('leaves arrows past the end of a short colors buffer untouched', () => {
		const arrows = new InstancedArrows({ count: 2 })

		arrows.update({ poses: TWO_ARROWS, colors: new Uint8Array([1, 2, 3]) })

		expect(instanceColors(arrows)).toStrictEqual([1, 2, 3, 0, 0, 0])
	})

	it('drops poses past the last arrow instead of throwing', () => {
		const arrows = new InstancedArrows({ count: 1 })

		expect(() => arrows.update({ poses: TWO_ARROWS })).not.toThrow()
		expect([...(arrows.poses.array as Float32Array)]).toStrictEqual([0, 0, 0, 0, 0, 1])
	})
})
