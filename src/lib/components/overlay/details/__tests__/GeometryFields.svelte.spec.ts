import { render, screen } from '@testing-library/svelte'
import userEvent from '@testing-library/user-event'
import '@testing-library/jest-dom/vitest'
import { describe, expect, it, vi } from 'vitest'

import type { EditableFrameGeometry } from '$lib/defaultFrameGeometry'

import GeometryFields from '../GeometryFields.svelte'

describe('GeometryFields', () => {
	it('renders the box controls for a box value', () => {
		render(GeometryFields, {
			props: { geometry: { type: 'box', x: 1, y: 2, z: 3 }, onchange: vi.fn(), includeNone: true },
		})

		expect(screen.getByLabelText('mutable box dimensions')).toBeInTheDocument()
	})

	it('renders no dimension controls for undefined', () => {
		render(GeometryFields, { props: { geometry: undefined, onchange: vi.fn(), includeNone: true } })

		expect(screen.queryByLabelText('mutable box dimensions')).not.toBeInTheDocument()
		expect(screen.queryByLabelText('mutable sphere dimensions')).not.toBeInTheDocument()
		expect(screen.queryByLabelText('mutable capsule dimensions')).not.toBeInTheDocument()
		expect(screen.getByText('None')).toBeInTheDocument()
	})

	it('emits that type default when a tab is picked', async () => {
		const emitted: EditableFrameGeometry[] = []
		render(GeometryFields, {
			props: {
				geometry: { type: 'box', x: 1, y: 2, z: 3 },
				onchange: (next: EditableFrameGeometry) => emitted.push(next),
				includeNone: true,
			},
		})

		await userEvent.click(screen.getByText('Sphere'))

		await vi.waitFor(() => expect(emitted).toEqual([{ type: 'sphere', r: 100 }]))
	})

	it('emits the whole box with the other dimensions preserved on a dimension change', async () => {
		const emitted: EditableFrameGeometry[] = []
		render(GeometryFields, {
			props: {
				geometry: { type: 'box', x: 10, y: 20, z: 30 },
				onchange: (next: EditableFrameGeometry) => emitted.push(next),
				includeNone: true,
			},
		})
		await vi.waitFor(() => expect(document.querySelector('.tp-pndtxtv input')).not.toBeNull())
		const xInput = document.querySelector<HTMLInputElement>('.tp-pndtxtv input')
		expect(xInput).not.toBeNull()

		await userEvent.tripleClick(xInput!)
		await userEvent.keyboard('55{Tab}')

		await vi.waitFor(() => expect(emitted.at(-1)).toEqual({ type: 'box', x: 55, y: 20, z: 30 }))
	})

	it('does not emit when the geometry prop changes', async () => {
		const onchange = vi.fn()
		const { rerender } = render(GeometryFields, {
			props: { geometry: { type: 'box', x: 1, y: 2, z: 3 }, onchange, includeNone: true },
		})

		await rerender({ geometry: { type: 'sphere', r: 5 }, onchange })
		await rerender({ geometry: { type: 'box', x: 9, y: 9, z: 9 }, onchange })

		expect(onchange).not.toHaveBeenCalled()
	})
})
