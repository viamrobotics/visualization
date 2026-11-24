import { render, screen } from '@testing-library/svelte'
import userEvent from '@testing-library/user-event'
import '@testing-library/jest-dom/vitest'
import { describe, expect, it, vi } from 'vitest'

import { axisField, enterNumber } from '#lib/__tests__/__fixtures__/numberFields.js'

import GeometryFields from '../GeometryFields.svelte'
import { MIXED, type Shared } from '../sharedValue'

const renderBox = (
	dimensions: Record<'x' | 'y' | 'z', Shared<number>> = { x: 10, y: 20, z: 30 }
) => {
	const ontypechange = vi.fn()
	const ondimensionchange = vi.fn()
	render(GeometryFields, {
		props: { type: 'box', dimensions, includeNone: true, ontypechange, ondimensionchange },
	})
	return { ontypechange, ondimensionchange }
}

describe('GeometryFields', () => {
	it('renders the box dimensions for a box', () => {
		renderBox()

		expect(screen.getByRole('group', { name: 'box dimensions (mm)' })).toBeInTheDocument()
	})

	it('renders no dimension fields for none', () => {
		render(GeometryFields, {
			props: {
				type: 'none',
				dimensions: {},
				includeNone: true,
				ontypechange: vi.fn(),
				ondimensionchange: vi.fn(),
			},
		})

		expect(screen.queryByRole('spinbutton')).not.toBeInTheDocument()
		expect(screen.getByRole('tab', { name: 'None' })).toHaveAttribute('aria-selected', 'true')
	})

	it('reports the picked type', async () => {
		const { ontypechange } = renderBox()

		await userEvent.click(screen.getByRole('tab', { name: 'Sphere' }))

		expect(ontypechange).toHaveBeenCalledWith('sphere')
	})

	it('reports only the dimension the user changed', async () => {
		const { ondimensionchange } = renderBox()

		await userEvent.type(screen.getByRole('spinbutton', { name: 'X' }), '5')

		expect(ondimensionchange).toHaveBeenLastCalledWith({ x: 105 })
	})

	it('reports no size of 0 or less, since typing is not clamped to the minimum', async () => {
		const { ondimensionchange } = renderBox()

		await enterNumber(axisField('box dimensions (mm)', 'X'), '-5')

		expect(ondimensionchange).not.toHaveBeenCalled()
	})

	it('shows a mixed dimension empty', () => {
		renderBox({ x: MIXED, y: 20, z: 30 })

		expect(screen.getByRole('spinbutton', { name: 'X' })).toHaveValue(null)
	})

	it('does not report a change when the props change', async () => {
		const ontypechange = vi.fn()
		const ondimensionchange = vi.fn()
		const { rerender } = render(GeometryFields, {
			props: {
				type: 'box',
				dimensions: { x: 1, y: 2, z: 3 },
				includeNone: true,
				ontypechange,
				ondimensionchange,
			},
		})

		await rerender({ type: 'sphere', dimensions: { r: 5 } })
		await rerender({ type: 'box', dimensions: { x: 9, y: 9, z: 9 } })

		expect(ontypechange).not.toHaveBeenCalled()
		expect(ondimensionchange).not.toHaveBeenCalled()
	})
})
