import { afterEach, describe, expect, it } from 'vitest'

import { isEditableTarget } from '../isEditableTarget'

afterEach(() => {
	document.body.replaceChildren()
})

describe('isEditableTarget', () => {
	it.each(['input', 'textarea', 'select'])('treats a %s as a field being typed into', (tag) => {
		expect(isEditableTarget(document.createElement(tag))).toBe(true)
	})

	it('treats a contenteditable element as a field being typed into', () => {
		const editor = document.createElement('div')
		editor.contentEditable = 'true'
		document.body.append(editor)

		expect(isEditableTarget(editor)).toBe(true)

		const child = document.createElement('span')
		editor.append(child)
		expect(isEditableTarget(child)).toBe(true)
	})

	it('does not treat a button as a field', () => {
		expect(isEditableTarget(document.createElement('button'))).toBe(false)
	})

	it('does not treat the page body or nothing as a field', () => {
		expect(isEditableTarget(document.body)).toBe(false)
		expect(isEditableTarget(null)).toBe(false)
	})
})
