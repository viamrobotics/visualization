import { render, screen } from '@testing-library/svelte'
import userEvent from '@testing-library/user-event'
import '@testing-library/jest-dom/vitest'
import { describe, expect, it, vi } from 'vitest'

import ClampedNumberFieldHost from './__fixtures__/ClampedNumberFieldHost.svelte'

const renderClamped = () => {
	const onwrite = vi.fn()
	render(ClampedNumberFieldHost, { props: { onwrite } })
	return { onwrite, field: screen.getByRole('spinbutton', { name: 'steps' }) }
}

describe('HeldNumberField', () => {
	it('keeps what the user typed while a clamped setter rewrites the value', async () => {
		const { onwrite, field } = renderClamped()

		await userEvent.clear(field)
		await userEvent.type(field, '150')

		expect(field).toHaveValue(150)
		expect(onwrite).toHaveBeenLastCalledWith(150)
	})

	it('shows the bound value once the field loses focus', async () => {
		const { field } = renderClamped()

		await userEvent.clear(field)
		await userEvent.type(field, '1')
		await userEvent.click(screen.getByRole('button', { name: 'elsewhere' }))

		expect(field, 'the clamp raised the typed 1 to the minimum of 2').toHaveValue(2)
	})

	it('writes nothing while the field is cleared', async () => {
		const { onwrite, field } = renderClamped()

		await userEvent.clear(field)

		expect(field).toHaveValue(null)
		expect(onwrite).not.toHaveBeenCalled()
	})
})
