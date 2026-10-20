import { render, screen } from '@testing-library/svelte'
import userEvent from '@testing-library/user-event'
import '@testing-library/jest-dom/vitest'
import { describe, expect, it } from 'vitest'

import KinematicsTcpDetails from '../KinematicsTcpDetails.svelte'
import { detailsWorkbench } from './__fixtures__/kinematicsDetailsWorkbench'

describe('<KinematicsTcpDetails>', () => {
	it('reparents the TCP to a joint', async () => {
		const workbench = detailsWorkbench()
		render(KinematicsTcpDetails, { props: { workbench } })

		await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Parent' }), 'elbow')

		expect(workbench.setTcpParent).toHaveBeenCalledWith('elbow')
	})
})
