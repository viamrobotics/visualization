import { render, screen } from '@testing-library/svelte'
import { describe, expect, it, vi } from 'vitest'
import ToggleGroup from '../ToggleGroup.svelte'
import userEvent from '@testing-library/user-event'

import '@testing-library/jest-dom/vitest'

describe('<ToggleGroup>', () => {
	it('renders all options using label/value fallback', () => {
		render(ToggleGroup, {
			props: {
				options: [{ label: 'One' }, { label: 'Two', value: '2' }, { label: 'Three', value: 'III' }],
				onSelect: vi.fn(),
			},
		})

		expect(screen.getByRole('radio', { name: 'One' })).toBeInTheDocument()
		expect(screen.getByRole('radio', { name: '2' })).toBeInTheDocument()
		expect(screen.getByRole('radio', { name: 'III' })).toBeInTheDocument()
	})

	it('Initially selects options', () => {
		render(ToggleGroup, {
			props: {
				options: [{ label: 'A', selected: true }, { label: 'B' }],
				onSelect: vi.fn(),
			},
		})

		expect(screen.getByRole('radio', { name: 'A' })).toHaveAttribute('aria-checked', 'true')
		expect(screen.getByRole('radio', { name: 'B' })).toHaveAttribute('aria-checked', 'false')
	})

	it('Initially selects options (multiple)', () => {
		render(ToggleGroup, {
			props: {
				multiple: true,
				options: [{ label: 'A', selected: true }, { label: 'B', selected: true }, { label: 'C' }],
				onSelect: vi.fn(),
			},
		})

		expect(screen.getByRole('button', { name: 'A' })).toHaveAttribute('aria-pressed', 'true')
		expect(screen.getByRole('button', { name: 'B' })).toHaveAttribute('aria-pressed', 'true')
		expect(screen.getByRole('button', { name: 'C' })).toHaveAttribute('aria-pressed', 'false')
	})

	it('selects an option and deselects the previous option', async () => {
		const onSelect = vi.fn()
		const user = userEvent.setup()

		render(ToggleGroup, {
			props: {
				options: [{ label: 'A', selected: true }, { label: 'B' }, { label: 'C' }],
				onSelect,
			},
		})

		const a = screen.getByRole('radio', { name: 'A' })
		const b = screen.getByRole('radio', { name: 'B' })

		expect(a).toHaveAttribute('aria-checked', 'true')
		expect(b).toHaveAttribute('aria-checked', 'false')

		await user.click(b)
		expect(onSelect).toHaveBeenLastCalledWith(['B'])
	})

	it('toggles membership in the selection array with multiple: true', async () => {
		const onSelect = vi.fn()
		const user = userEvent.setup()

		render(ToggleGroup, {
			props: {
				multiple: true,
				options: [{ label: 'A', selected: true }, { label: 'B' }, { label: 'C' }],
				onSelect,
			},
		})

		const a = screen.getByRole('button', { name: 'A' })
		const b = screen.getByRole('button', { name: 'B' })

		expect(a).toHaveAttribute('aria-pressed', 'true')
		expect(b).toHaveAttribute('aria-pressed', 'false')

		// add B
		await user.click(b)
		expect(onSelect).toHaveBeenLastCalledWith(['A', 'B'])
	})
})
