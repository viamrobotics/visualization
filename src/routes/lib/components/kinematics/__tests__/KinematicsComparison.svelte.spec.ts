import { render, screen } from '@testing-library/svelte'
import '@testing-library/jest-dom/vitest'
import { describe, expect, it } from 'vitest'

import { Vector3 } from '$lib/buf/common/v1/common_pb'
import { Snapshot } from '$lib/buf/draw/v1/snapshot_pb'
import { LinkReport, ValidationReport } from '$lib/buf/kinematics/v1/spec_pb'

import KinematicsComparison from '../KinematicsComparison.svelte'
import { fakeWorkbench } from './__fixtures__/fakeWorkbench'

const report = (triangles: number, x: number, modelBytes: bigint) =>
	new ValidationReport({
		modelBytes,
		links: [new LinkReport({ id: 'base', triangles, extent: new Vector3({ x, y: 1, z: 1 }) })],
	})

describe('<KinematicsComparison>', () => {
	it('shows the model size before and after', () => {
		const { workbench } = fakeWorkbench({
			report: report(500, 200, 2000n),
			previous: { report: report(1000, 100, 4000n), snapshot: new Snapshot() },
		})
		render(KinematicsComparison, { props: { workbench } })

		expect(screen.getByText('4 kB to 2 kB')).toBeInTheDocument()
	})

	it('toggles the previous geometry', () => {
		const { workbench } = fakeWorkbench({
			report: report(500, 200, 2000n),
			previous: { report: report(1000, 100, 4000n), snapshot: new Snapshot() },
		})
		render(KinematicsComparison, { props: { workbench } })
		expect(screen.getByRole('switch', { name: 'Show previous geometry' })).toBeInTheDocument()
	})

	it('renders nothing without a previous build', () => {
		const { workbench } = fakeWorkbench({ report: report(500, 200, 2000n) })
		render(KinematicsComparison, { props: { workbench } })
		expect(screen.queryByRole('region', { name: 'Comparison' })).not.toBeInTheDocument()
	})
})
