import { render, screen } from '@testing-library/svelte'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import '@testing-library/jest-dom/vitest'

import Button from '../Button.svelte'

describe('<Button> (dashboard)', () => {
	it('renders a radio button with the given description', () => {
		render(Button, {
			props: { icon: 'cursor-move', description: 'Translate', active: false },
		})

		const radio = screen.getByRole('radio', { name: 'Translate' })
		expect(radio).toBeInTheDocument()
		expect(radio).toHaveAttribute('aria-checked', 'false')
	})

	it('marks the radio as checked when active', () => {
		render(Button, {
			props: { icon: 'cursor-move', description: 'Translate', active: true },
		})

		expect(screen.getByRole('radio', { name: 'Translate' })).toHaveAttribute('aria-checked', 'true')
	})

	it('applies dark gray active styles when active', () => {
		render(Button, {
			props: { icon: 'cursor-move', description: 'Translate', active: true },
		})

		const label = screen.getByRole('radio', { name: 'Translate' }).closest('label')!
		expect(label.className).toContain('bg-[#666]')
		expect(label.className).toContain('text-white')
		expect(label.className).toContain('border-[#666]')
	})

	it('applies white inactive styles when not active', () => {
		render(Button, {
			props: { icon: 'cursor-move', description: 'Translate', active: false },
		})

		const label = screen.getByRole('radio', { name: 'Translate' }).closest('label')!
		expect(label.className).toContain('bg-white')
		expect(label.className).toContain('text-gray-8')
		expect(label.className).toContain('border-gray-5')
	})

	it('renders the hotkey in the tooltip description', async () => {
		const user = userEvent.setup()
		render(Button, {
			props: { icon: 'cursor-move', description: 'Translate', hotkey: '1' },
		})

		await user.hover(screen.getByRole('radio', { name: 'Translate' }))

		expect(await screen.findByText('1')).toBeInTheDocument()
	})

	it('preserves aria and role when disableTooltip is true and active', () => {
		render(Button, {
			props: {
				icon: 'cursor-move',
				description: 'Translate',
				active: true,
				disableTooltip: true,
			},
		})

		const radio = screen.getByRole('radio', { name: 'Translate' })
		expect(radio).toBeInTheDocument()
		expect(radio).toHaveAttribute('aria-checked', 'true')
	})

	it('preserves aria and role when disableTooltip is true and inactive', () => {
		render(Button, {
			props: {
				icon: 'cursor-move',
				description: 'Translate',
				active: false,
				disableTooltip: true,
			},
		})

		const radio = screen.getByRole('radio', { name: 'Translate' })
		expect(radio).toBeInTheDocument()
		expect(radio).toHaveAttribute('aria-checked', 'false')
	})
})
