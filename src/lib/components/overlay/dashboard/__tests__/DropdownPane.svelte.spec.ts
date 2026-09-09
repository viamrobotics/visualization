import { fireEvent, render, screen } from '@testing-library/svelte'
import { createRawSnippet } from 'svelte'
import { describe, expect, it } from 'vitest'
import '@testing-library/jest-dom/vitest'

import DropdownPane from '../DropdownPane.svelte'

// Tweakpane's root element class, the wrapper a plain pane must not render.
const TWEAKPANE_ROOT_SELECTOR = '.tp-dfwv'

const childSnippet = () =>
	createRawSnippet(() => ({
		render: () => '<p data-testid="dropdown-pane-child">child content</p>',
	}))

describe('<DropdownPane>', () => {
	it('renders children directly, without the Pane wrapper, when plain is set', async () => {
		render(DropdownPane, {
			props: { title: 'Gizmo tools', plain: true, children: childSnippet() },
		})

		await fireEvent.click(screen.getByRole('radio', { name: 'Gizmo tools' }))

		expect(await screen.findByTestId('dropdown-pane-child')).toBeInTheDocument()
		expect(document.querySelector(TWEAKPANE_ROOT_SELECTOR)).not.toBeInTheDocument()
	})

	it('passes the icon prop through to the trigger button', () => {
		render(DropdownPane, {
			props: { title: 'Gizmo tools', icon: 'shapes', children: childSnippet() },
		})

		const trigger = screen.getByRole('radio', { name: 'Gizmo tools' }).closest('label')!
		expect(trigger.querySelector('svg.lucide-shapes')).not.toBeNull()
	})

	it('passes the class prop through to the trigger button', () => {
		render(DropdownPane, {
			props: { title: 'Gizmo tools', class: 'rounded-r-none', children: childSnippet() },
		})

		const trigger = screen.getByRole('radio', { name: 'Gizmo tools' }).closest('label')!
		expect(trigger.className).toContain('rounded-r-none')
	})
})
