import { beforeEach, describe, expect, it } from 'vitest'

import { isFolderExpanded, mergeExpandedFolders } from '../expandedFolders.svelte'

const STORAGE_KEY = 'world-tree-expanded-folders'

describe('isFolderExpanded', () => {
	beforeEach(() => {
		localStorage.removeItem(STORAGE_KEY)
	})

	it('opens a folder the user has never toggled', () => {
		expect(isFolderExpanded('Frames', false)).toBe(true)
	})

	it('closes a folder the user has never toggled when it defaults to collapsed', () => {
		expect(isFolderExpanded('Frameless components', true)).toBe(false)
	})

	it('returns the stored state over the default', () => {
		localStorage.setItem(STORAGE_KEY, JSON.stringify({ Frames: false }))

		expect(isFolderExpanded('Frames', false)).toBe(false)
	})

	it('falls back to the default when the stored entry is not valid JSON', () => {
		localStorage.setItem(STORAGE_KEY, 'not json at all')

		expect(isFolderExpanded('Frames', false)).toBe(true)
	})

	it('falls back to the default when the stored entry parses to null', () => {
		localStorage.setItem(STORAGE_KEY, 'null')

		expect(isFolderExpanded('Frames', false)).toBe(true)
	})
})

describe('mergeExpandedFolders', () => {
	beforeEach(() => {
		localStorage.removeItem(STORAGE_KEY)
	})

	it('keeps the state of a folder it was not given', () => {
		mergeExpandedFolders({ Frames: false })

		mergeExpandedFolders({ 'Point clouds': false })

		expect(isFolderExpanded('Frames', false)).toBe(false)
	})

	it('overwrites the state of a folder it was given', () => {
		mergeExpandedFolders({ Frames: false })

		mergeExpandedFolders({ Frames: true })

		expect(isFolderExpanded('Frames', false)).toBe(true)
	})

	it('writes over a corrupt entry rather than throwing', () => {
		localStorage.setItem(STORAGE_KEY, 'not json at all')

		mergeExpandedFolders({ Frames: false })

		expect(isFolderExpanded('Frames', false)).toBe(false)
	})
})
