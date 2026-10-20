import { render, screen } from '@testing-library/svelte'
import userEvent from '@testing-library/user-event'
import '@testing-library/jest-dom/vitest'
import { describe, expect, it, vi } from 'vitest'

import KinematicsMissingSources from '../KinematicsMissingSources.svelte'
import { fakeWorkbench } from './__fixtures__/fakeWorkbench'

describe('<KinematicsMissingSources>', () => {
	it('supplies a listed path with the chosen file', async () => {
		const { workbench, setSourceBytes } = fakeWorkbench({
			status: 'incomplete',
			missingSources: ['arm/a.stl', 'b.ply'],
		})
		render(KinematicsMissingSources, { props: { workbench } })

		expect(screen.getByRole('button', { name: 'Choose file for b.ply' })).toBeInTheDocument()
		for (const input of screen.getAllByTestId('kinematics-source-input')) {
			expect(input.getAttribute('accept')).toContain('.obj')
			expect(input.getAttribute('accept')).toContain('.dae')
		}
		await userEvent.upload(
			screen.getAllByTestId('kinematics-source-input')[1]!,
			new File([new Uint8Array([9, 8])], 'whatever.ply')
		)

		await vi.waitFor(() =>
			expect(setSourceBytes).toHaveBeenCalledWith('b.ply', new Uint8Array([9, 8]))
		)
		expect(screen.getByText('arm/a.stl')).toBeInTheDocument()
	})

	it('renders nothing when the project is complete', () => {
		const { workbench } = fakeWorkbench()
		render(KinematicsMissingSources, { props: { workbench } })
		expect(screen.queryByRole('region', { name: 'Missing mesh files' })).not.toBeInTheDocument()
	})
})
