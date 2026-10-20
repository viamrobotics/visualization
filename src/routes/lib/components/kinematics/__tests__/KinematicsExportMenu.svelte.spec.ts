import { render, screen, within } from '@testing-library/svelte'
import userEvent from '@testing-library/user-event'
import '@testing-library/jest-dom/vitest'
import { describe, expect, it, vi } from 'vitest'

import { ValidationReport } from '$lib/buf/kinematics/v1/spec_pb'

import KinematicsExportMenu from '../KinematicsExportMenu.svelte'
import { fakeWorkbench } from './__fixtures__/fakeWorkbench'

vi.mock('@viamrobotics/prime-core', async (importOriginal) => ({
	...(await importOriginal<typeof import('@viamrobotics/prime-core')>()),
	useToast: () => vi.fn(),
}))

describe('<KinematicsExportMenu>', () => {
	it('is disabled before a build is ready', () => {
		const { workbench } = fakeWorkbench({ status: 'empty' })
		render(KinematicsExportMenu, { props: { workbench } })
		expect(screen.getByRole('button', { name: /Export/ })).toBeDisabled()
	})

	it('shows the report once a build exists', async () => {
		const { workbench } = fakeWorkbench({
			status: 'ready',
			report: new ValidationReport({ dof: 3 }),
		})
		render(KinematicsExportMenu, { props: { workbench } })

		const trigger = screen.getByRole('button', { name: 'Export' })
		expect(trigger).toBeEnabled()
		await userEvent.click(trigger)
		expect(await screen.findByRole('region', { name: 'Model report' })).toBeInTheDocument()
		expect(screen.getByText('Viam check passed')).toBeInTheDocument()
		expect(
			screen.getByText("Loads and round-trips the way viam-server reads a module's kinematics.")
		).toBeInTheDocument()
	})

	it('leads with the verdict, then the failures, then the details and exports', async () => {
		const { workbench } = fakeWorkbench({
			status: 'ready',
			report: new ValidationReport({ failures: ['link a is too large', 'link b is empty'] }),
		})
		render(KinematicsExportMenu, { props: { workbench } })
		await userEvent.click(screen.getByRole('button', { name: 'Export' }))

		const verdict = await screen.findByText('Viam check failed')
		const failures = screen.getByRole('list', { name: 'Failures' })
		const details = screen.getByRole('region', { name: 'Model report' })
		const exports = screen.getByRole('region', { name: 'Export' })
		const follows = (a: Node, b: Node) =>
			Boolean(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING)
		expect(within(failures).getByText('link a is too large')).toBeInTheDocument()
		expect(within(failures).getByText('link b is empty')).toBeInTheDocument()
		expect(follows(verdict, failures)).toBe(true)
		expect(follows(failures, details)).toBe(true)
		expect(follows(details, exports)).toBe(true)
		expect(screen.getByRole('button', { name: 'Add to an existing module' })).toBeInTheDocument()
		expect(screen.getByLabelText('Viam model')).toBeInTheDocument()
	})

	it('passes with warnings, lists them, and Simplify all calls the workbench', async () => {
		const { workbench } = fakeWorkbench({
			status: 'ready',
			report: new ValidationReport({ warnings: ['base has 90000 triangles'] }),
		})
		render(KinematicsExportMenu, { props: { workbench } })
		await userEvent.click(screen.getByRole('button', { name: 'Export' }))
		expect(await screen.findByText('Viam check passed with warnings')).toBeInTheDocument()
		expect(
			within(screen.getByRole('list', { name: 'Warnings' })).getByText('base has 90000 triangles')
		).toBeInTheDocument()
		expect(
			screen.getByRole('button', { name: 'Simplify all' }).closest('[role="status"]')
		).toBeNull()
		await userEvent.click(screen.getByRole('button', { name: 'Simplify all' }))
		expect(workbench.simplifyAll).toHaveBeenCalledTimes(1)
	})

	it('hides warnings and Simplify all when the check failed', async () => {
		const { workbench } = fakeWorkbench({
			status: 'ready',
			report: new ValidationReport({ failures: ['bad'], warnings: ['heavy'] }),
		})
		render(KinematicsExportMenu, { props: { workbench } })
		await userEvent.click(screen.getByRole('button', { name: 'Export' }))
		expect(await screen.findByText('Viam check failed')).toBeInTheDocument()
		expect(screen.queryByRole('button', { name: 'Simplify all' })).not.toBeInTheDocument()
	})
})
