import { cleanup, render, screen } from '@testing-library/svelte'
import userEvent from '@testing-library/user-event'
import '@testing-library/jest-dom/vitest'
import { describe, expect, it, vi } from 'vitest'

import { ImportReport } from '$lib/buf/kinematics/v1/spec_pb'

import KinematicsStatus from '../KinematicsStatus.svelte'
import { fakeWorkbench } from './__fixtures__/fakeWorkbench'

vi.mock('$lib/components/overlay/Portals/OverlayPortal.svelte', async () => {
	const passthrough = await import('./__fixtures__/PassthroughPortal.svelte')
	return { default: passthrough.default }
})

const baseUrl = 'http://localhost:3030'

describe('<KinematicsStatus>', () => {
	it('shows the empty hint when nothing is loaded', () => {
		const { workbench } = fakeWorkbench({ status: 'empty' })
		render(KinematicsStatus, { props: { workbench, baseUrl } })
		expect(
			screen.getByText(
				'Drop STL, PLY, OBJ, or DAE mesh files, a project zip, or a folder, or use Add.'
			)
		).toBeInTheDocument()
	})

	it('shows the building state without the empty hint', () => {
		const { workbench } = fakeWorkbench({ status: 'building' })
		render(KinematicsStatus, { props: { workbench, baseUrl } })
		expect(screen.getByText('Building...')).toBeInTheDocument()
		expect(screen.queryByText(/Drop STL/)).not.toBeInTheDocument()
	})

	it('shows the error banner with the draw server URL', () => {
		const { workbench } = fakeWorkbench({ status: 'error', error: 'boom' })
		render(KinematicsStatus, { props: { workbench, baseUrl } })
		const alert = screen.getByRole('alert')
		expect(alert).toHaveTextContent('boom')
		expect(alert).toHaveTextContent(baseUrl)
		expect(alert).toHaveTextContent('make up')
	})

	it('asks which link is the TCP and passes the choice on', async () => {
		const { workbench } = fakeWorkbench({
			importReport: new ImportReport({
				urdfPath: 'a.urdf',
				tcpLink: '',
				tcpCandidates: ['wrist', 'tip'],
			}),
		})
		render(KinematicsStatus, { props: { workbench, baseUrl } })
		expect(screen.getByText('Which link is the TCP?')).toBeInTheDocument()
		expect(screen.getByRole('button', { name: 'Use as TCP' }).closest('[aria-live]')).toBeNull()
		await userEvent.selectOptions(screen.getByLabelText('Which link is the TCP?'), 'tip')
		await userEvent.click(screen.getByRole('button', { name: 'Use as TCP' }))
		expect(workbench.chooseImportTcp).toHaveBeenCalledWith('tip')
	})

	it('does not ask for a TCP when one is set or there are no candidates', () => {
		const set = fakeWorkbench({
			importReport: new ImportReport({ tcpLink: 'tip', tcpCandidates: ['tip'] }),
		})
		render(KinematicsStatus, { props: { workbench: set.workbench, baseUrl } })
		expect(screen.queryByText('Which link is the TCP?')).not.toBeInTheDocument()
		cleanup()
		const none = fakeWorkbench({ importReport: new ImportReport({ tcpLink: '' }) })
		render(KinematicsStatus, { props: { workbench: none.workbench, baseUrl } })
		expect(screen.queryByText('Which link is the TCP?')).not.toBeInTheDocument()
	})

	it('summarises the import, lists the changes, and can be dismissed', async () => {
		const { workbench } = fakeWorkbench({
			importReport: new ImportReport({
				urdfPath: 'arm/robot.urdf',
				tcpLink: 'tip',
				dropped: ['transmission a', 'gazebo b'],
				renamed: ['base link -> base_link'],
				visualFallbacks: ['mesh.dae'],
			}),
		})
		render(KinematicsStatus, { props: { workbench, baseUrl } })
		const summary = screen.getByRole('region', { name: 'Import summary' })
		expect(summary).toHaveTextContent('Imported arm/robot.urdf.')
		expect(summary).toHaveTextContent('2 elements dropped, 1 item renamed, 1 visual fallback.')
		expect(summary).toHaveTextContent('Dropped: gazebo b')
		expect(summary).toHaveTextContent('Renamed: base link -> base_link')
		expect(summary).toHaveTextContent('Visual fallback: mesh.dae')
		await userEvent.click(screen.getByRole('button', { name: 'Dismiss' }))
		expect(screen.queryByRole('region', { name: 'Import summary' })).not.toBeInTheDocument()
	})
})
