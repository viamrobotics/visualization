import { render, screen } from '@testing-library/svelte'
import userEvent from '@testing-library/user-event'
import '@testing-library/jest-dom/vitest'
import { describe, expect, it, vi } from 'vitest'

import KinematicsModelDetails from '../KinematicsModelDetails.svelte'
import { detailsWorkbench } from './__fixtures__/kinematicsDetailsWorkbench'

describe('<KinematicsModelDetails>', () => {
	it('adds a joint under the model and selects it', async () => {
		const workbench = detailsWorkbench()
		const select = vi.fn()
		render(KinematicsModelDetails, { props: { workbench, select } })

		await userEvent.click(screen.getByRole('button', { name: 'Add joint' }))

		expect(workbench.addJoint).toHaveBeenCalledWith({})
		expect(select).toHaveBeenCalledWith('new-joint')
	})

	it('explains the root frame', () => {
		render(KinematicsModelDetails, {
			props: { workbench: detailsWorkbench(), select: vi.fn() },
		})

		expect(
			screen.getByText(
				"root: your component's frame on the robot. Every link and the TCP attach to it."
			)
		).toBeInTheDocument()
	})

	it('shows the model name', () => {
		render(KinematicsModelDetails, {
			props: { workbench: detailsWorkbench(), select: vi.fn() },
		})

		expect(screen.getByLabelText('Model name')).toHaveValue('rig')
	})
})
