import { render, screen } from '@testing-library/svelte'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'

import MaximizeButton from '../MaximizeButton.svelte'

import '@testing-library/jest-dom/vitest'

describe('<MaximizeButton>', () => {
	it('toggles maximized on click', async () => {
		const user = userEvent.setup()
		render(MaximizeButton, { props: { maximized: false } })

		const button = screen.getByRole('button', { name: 'Maximize' })
		expect(button).toHaveAttribute('aria-pressed', 'false')

		await user.click(button)

		expect(screen.getByRole('button', { name: 'Restore' })).toHaveAttribute('aria-pressed', 'true')
	})

	it('locks page scroll while maximized and restores it on restore', async () => {
		const user = userEvent.setup()
		render(MaximizeButton, { props: { maximized: false } })

		await user.click(screen.getByRole('button', { name: 'Maximize' }))

		expect(document.body.style.overflow).toBe('hidden')
		expect(document.documentElement.style.overflow).toBe('hidden')

		await user.click(screen.getByRole('button', { name: 'Restore' }))

		expect(document.body.style.overflow).toBe('')
		expect(document.documentElement.style.overflow).toBe('')
	})
})
