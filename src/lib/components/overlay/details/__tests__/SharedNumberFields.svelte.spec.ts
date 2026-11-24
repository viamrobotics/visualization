import { render, screen } from '@testing-library/svelte'
import userEvent from '@testing-library/user-event'
import '@testing-library/jest-dom/vitest'
import { describe, expect, it, vi } from 'vitest'

import { MIXED } from '../sharedValue'
import SharedNumberFieldsHost from './__fixtures__/SharedNumberFieldsHost.svelte'

const renderFields = (initial: Record<'x' | 'y' | 'z', number | typeof MIXED>) => {
	const onchange = vi.fn()
	render(SharedNumberFieldsHost, { props: { initial, onchange } })
	return onchange
}

describe('SharedNumberFields', () => {
	it('reports only the field the user edited, so the others stay each entity’s own', async () => {
		const onchange = renderFields({ x: MIXED, y: 50, z: 0 })

		await userEvent.clear(screen.getByRole('spinbutton', { name: 'Y' }))
		await userEvent.type(screen.getByRole('spinbutton', { name: 'Y' }), '60')

		expect(onchange).toHaveBeenLastCalledWith({ y: 60 })
	})

	it('reports a value typed into a mixed field', async () => {
		const onchange = renderFields({ x: MIXED, y: 50, z: 0 })

		await userEvent.type(screen.getByRole('spinbutton', { name: 'X' }), '5')

		expect(onchange).toHaveBeenLastCalledWith({ x: 5 })
	})

	it('shows a mixed field empty with a dash placeholder', () => {
		renderFields({ x: MIXED, y: 50, z: 0 })

		const field = screen.getByRole('spinbutton', { name: 'X' })
		expect(field).toHaveValue(null)
		expect(field).toHaveAttribute('placeholder', '-')
	})
})
