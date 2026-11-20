import { render, screen } from '@testing-library/svelte'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import '@testing-library/jest-dom/vitest'

import { TRANSFORM_KEYBINDINGS } from '#lib/hooks/transformKeybindings.js'

import Button from '../Button.svelte'

describe('<Button> (dashboard)', () => {
	it('announces an inactive toggle as not pressed', () => {
		render(Button, {
			props: { icon: 'cursor-move', description: 'Translate', active: false },
		})

		expect(screen.getByRole('button', { name: 'Translate' })).toHaveAttribute(
			'aria-pressed',
			'false'
		)
	})

	it('announces an active toggle as pressed', () => {
		render(Button, {
			props: { icon: 'cursor-move', description: 'Translate', active: true },
		})

		expect(screen.getByRole('button', { name: 'Translate' })).toHaveAttribute(
			'aria-pressed',
			'true'
		)
	})

	it('announces a plain action with no pressed state when active is unset', () => {
		render(Button, {
			props: { icon: 'camera', description: 'Reset camera' },
		})

		expect(screen.getByRole('button', { name: 'Reset camera' })).not.toHaveAttribute(
			'aria-pressed'
		)
	})

	it('renders the keybinding in the tooltip description', async () => {
		const user = userEvent.setup()
		render(Button, {
			props: {
				icon: 'cursor-move',
				description: 'Translate',
				keybinding: TRANSFORM_KEYBINDINGS.translate,
			},
		})

		await user.hover(screen.getByRole('button', { name: 'Translate' }))

		expect(await screen.findByText('1')).toBeInTheDocument()
	})

	it('keeps the pressed state when disableTooltip is true and active', () => {
		render(Button, {
			props: {
				icon: 'cursor-move',
				description: 'Translate',
				active: true,
				disableTooltip: true,
			},
		})

		expect(screen.getByRole('button', { name: 'Translate' })).toHaveAttribute(
			'aria-pressed',
			'true'
		)
	})

	it('keeps the pressed state when disableTooltip is true and inactive', () => {
		render(Button, {
			props: {
				icon: 'cursor-move',
				description: 'Translate',
				active: false,
				disableTooltip: true,
			},
		})

		expect(screen.getByRole('button', { name: 'Translate' })).toHaveAttribute(
			'aria-pressed',
			'false'
		)
	})
})
