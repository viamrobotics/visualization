import { render, screen } from '@testing-library/svelte'
import { createWorld } from 'koota'
import { describe, expect, it } from 'vitest'
import '@testing-library/jest-dom/vitest'

import {
	createDetailsSections,
	DETAILS_SECTIONS_CONTEXT_KEY,
} from '#lib/hooks/useDetailsSections.svelte.js'

import DetailsSectionsHost from './__fixtures__/DetailsSectionsHost.svelte'

describe('DetailsSections', () => {
	const world = createWorld()

	const renderSections = (ownsAppearance: boolean) =>
		render(DetailsSectionsHost, {
			props: { entities: [world.spawn()], ownsAppearance },
			context: new Map([[DETAILS_SECTIONS_CONTEXT_KEY, createDetailsSections()]]),
		})

	it('leaves out a section that replaces appearance when the panel edits appearance itself', () => {
		renderSections(true)

		expect(screen.queryByText('session appearance')).not.toBeInTheDocument()
	})

	it('keeps sections that only add to appearance when the panel edits appearance itself', () => {
		renderSections(true)

		expect(screen.getByText('coverage toggle')).toBeInTheDocument()
	})

	it('shows a section that replaces appearance in a panel without its own editor', () => {
		renderSections(false)

		expect(screen.getByText('session appearance')).toBeInTheDocument()
	})
})
