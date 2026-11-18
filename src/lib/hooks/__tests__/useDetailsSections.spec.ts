import { describe, expect, it } from 'vitest'

import type { DetailsTabId } from '$lib/hooks/useDetailsSections.svelte'

import {
	createDetailsSections,
	type DetailsSection,
	sectionsForTab,
} from '$lib/hooks/useDetailsSections.svelte'

const section = (tab?: DetailsTabId): DetailsSection => ({
	snippet: (() => undefined) as unknown as DetailsSection['snippet'],
	tab,
})

describe('createDetailsSections registry', () => {
	it('reports sections in registration order', () => {
		const sections = createDetailsSections()
		const first = section()
		const second = section()

		sections.register(first)
		sections.register(second)

		expect(sections.current).toEqual([first, second])
	})

	it('keeps other sections when one is released', () => {
		const sections = createDetailsSections()
		const first = section()
		const second = section()

		const release = sections.register(first)
		sections.register(second)
		release()

		expect(sections.current).toEqual([second])
	})

	it('ignores a release called more than once', () => {
		const sections = createDetailsSections()
		const stale = section()

		const release = sections.register(stale)
		release()
		sections.register(stale)
		release()

		expect(sections.current).toEqual([stale])
	})
})

describe('sectionsForTab', () => {
	it('routes a section that names no tab to the details tab', () => {
		const untabbed = section()

		expect(sectionsForTab([untabbed], 'details')).toEqual([untabbed])
	})

	it('keeps a section that names no tab out of the appearance tab', () => {
		expect(sectionsForTab([section()], 'appearance')).toEqual([])
	})

	it('routes a section to the tab it names', () => {
		const appearance = section('appearance')

		expect(sectionsForTab([section(), appearance], 'appearance')).toEqual([appearance])
	})

	it('preserves registration order within a tab', () => {
		const first = section('appearance')
		const second = section('appearance')

		expect(sectionsForTab([first, section('details'), second], 'appearance')).toEqual([
			first,
			second,
		])
	})
})
