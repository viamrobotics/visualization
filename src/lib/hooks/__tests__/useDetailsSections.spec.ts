import { describe, expect, it } from 'vitest'

import { createDetailsSections, type DetailsSection } from '$lib/hooks/useDetailsSections.svelte'

const section = (): DetailsSection => ({
	snippet: (() => undefined) as unknown as DetailsSection['snippet'],
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
