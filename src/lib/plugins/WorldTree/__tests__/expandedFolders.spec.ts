import { PersistedState } from 'runed'
import { beforeEach, describe, expect, it } from 'vitest'

import { createExpandedFolders, EXPANDED_FOLDERS_STORAGE_KEY } from '../expandedFolders.svelte'

const storedFolders = () =>
	createExpandedFolders(new PersistedState<unknown>(EXPANDED_FOLDERS_STORAGE_KEY, {}))

describe('isFolderExpanded', () => {
	beforeEach(() => {
		localStorage.removeItem(EXPANDED_FOLDERS_STORAGE_KEY)
	})

	it('opens a folder the user has never toggled', () => {
		expect(storedFolders().isFolderExpanded('Frames', false)).toBe(true)
	})

	it('closes a folder the user has never toggled when it defaults to collapsed', () => {
		expect(storedFolders().isFolderExpanded('Frameless components', true)).toBe(false)
	})

	it('returns the stored state over the default', () => {
		localStorage.setItem(EXPANDED_FOLDERS_STORAGE_KEY, JSON.stringify({ Frames: false }))

		expect(storedFolders().isFolderExpanded('Frames', false)).toBe(false)
	})

	it('falls back to the default when the stored entry is not valid JSON', () => {
		localStorage.setItem(EXPANDED_FOLDERS_STORAGE_KEY, 'not json at all')

		expect(storedFolders().isFolderExpanded('Frames', false)).toBe(true)
	})

	it('falls back to the default when the stored entry parses to null', () => {
		localStorage.setItem(EXPANDED_FOLDERS_STORAGE_KEY, 'null')

		expect(storedFolders().isFolderExpanded('Frames', false)).toBe(true)
	})
})

describe('mergeExpandedFolders', () => {
	beforeEach(() => {
		localStorage.removeItem(EXPANDED_FOLDERS_STORAGE_KEY)
	})

	it('keeps the state of a folder it was not given', () => {
		const folders = storedFolders()
		folders.mergeExpandedFolders({ Frames: false })

		folders.mergeExpandedFolders({ 'Point clouds': false })

		expect(folders.isFolderExpanded('Frames', false)).toBe(false)
	})

	it('overwrites the state of a folder it was given', () => {
		const folders = storedFolders()
		folders.mergeExpandedFolders({ Frames: false })

		folders.mergeExpandedFolders({ Frames: true })

		expect(folders.isFolderExpanded('Frames', false)).toBe(true)
	})

	it('writes over a corrupt entry rather than throwing', () => {
		localStorage.setItem(EXPANDED_FOLDERS_STORAGE_KEY, 'not json at all')
		const folders = storedFolders()

		folders.mergeExpandedFolders({ Frames: false })

		expect(folders.isFolderExpanded('Frames', false)).toBe(false)
	})
})
