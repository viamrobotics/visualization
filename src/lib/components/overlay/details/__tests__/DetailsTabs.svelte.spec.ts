import { render, screen } from '@testing-library/svelte'
import userEvent from '@testing-library/user-event'
import { createRawSnippet } from 'svelte'
import '@testing-library/jest-dom/vitest'
import { describe, expect, it } from 'vitest'

import DetailsTabs, { type DetailsTab } from '../DetailsTabs.svelte'

describe('DetailsTabs', () => {
	const tabNamed = (id: string, label: string): DetailsTab => ({
		id,
		label,
		content: createRawSnippet(() => ({ render: () => `<p>${label} content</p>` })),
	})

	const details = tabNamed('details', 'Details')
	const appearance = tabNamed('appearance', 'Appearance')

	it('selects the first tab on mount', () => {
		render(DetailsTabs, { props: { items: [details, appearance] } })

		expect(screen.getByText('Details content')).toBeVisible()
		expect(screen.getByText('Appearance content')).not.toBeVisible()
	})

	it('reveals a tab panel when its trigger is clicked', async () => {
		render(DetailsTabs, { props: { items: [details, appearance] } })

		await userEvent.click(screen.getByRole('tab', { name: 'Appearance' }))

		expect(screen.getByText('Appearance content')).toBeVisible()
		expect(screen.getByText('Details content')).not.toBeVisible()
	})

	it('omits the tab strip when there is a single tab', () => {
		render(DetailsTabs, { props: { items: [details] } })

		expect(screen.queryByRole('tablist')).not.toBeInTheDocument()
		expect(screen.getByText('Details content')).toBeVisible()
	})

	it('falls back to the first tab when the selected tab is dropped', async () => {
		const { rerender } = render(DetailsTabs, { props: { items: [details, appearance] } })
		await userEvent.click(screen.getByRole('tab', { name: 'Appearance' }))

		await rerender({ items: [details] })

		expect(screen.getByText('Details content')).toBeVisible()
	})
})
