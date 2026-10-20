import { describe, expect, it } from 'vitest'

import { isSelectionStart } from '../isSelectionStart'

const pointerdown = (init: PointerEventInit) => new PointerEvent('pointerdown', init)

describe('isSelectionStart', () => {
	it('starts on a left press while selecting', () => {
		expect(isSelectionStart(pointerdown({ button: 0, pointerType: 'mouse' }), true)).toBe(true)
	})

	it('starts on a touch contact while selecting', () => {
		expect(isSelectionStart(pointerdown({ button: 0, pointerType: 'touch' }), true)).toBe(true)
	})

	it('starts on shift + left press when not selecting', () => {
		expect(isSelectionStart(pointerdown({ button: 0, shiftKey: true }), false)).toBe(true)
	})

	it('ignores a left press when neither selecting nor shift', () => {
		expect(isSelectionStart(pointerdown({ button: 0 }), false)).toBe(false)
	})

	it.each([
		['middle', 1],
		['right', 2],
	])('leaves a %s press to the camera controls', (_, button) => {
		expect(isSelectionStart(pointerdown({ button, pointerType: 'mouse' }), true)).toBe(false)
		expect(isSelectionStart(pointerdown({ button, shiftKey: true }), false)).toBe(false)
	})
})
