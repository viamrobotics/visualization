import { render, screen, within } from '@testing-library/svelte'
import '@testing-library/jest-dom/vitest'
import { describe, expect, it } from 'vitest'

import { Vector3 } from '$lib/buf/common/v1/common_pb'
import {
	CollisionShape,
	LinkReport,
	Primitive,
	Primitive_Box,
	Primitive_Cylinder,
	ValidationReport,
} from '$lib/buf/kinematics/v1/spec_pb'

import KinematicsReport from '../KinematicsReport.svelte'

const report = (init: Partial<ValidationReport>) => new ValidationReport(init)

describe('<KinematicsReport>', () => {
	it('prompts when there is no report', () => {
		render(KinematicsReport, { props: { report: undefined } })

		expect(screen.getByText('No report yet.')).toBeInTheDocument()
	})

	it('renders degrees of freedom, per-link shape, triangles and extent rounded to one decimal', () => {
		render(KinematicsReport, {
			props: {
				report: report({
					dof: 6,
					links: [
						new LinkReport({
							id: 'base',
							shape: CollisionShape.MESH,
							triangles: 1234,
							extent: new Vector3({ x: 100.26, y: 20, z: 0.04 }),
						}),
					],
				}),
			},
		})

		const link = screen.getByText('base').closest('li')!
		expect(within(link).getByText('mesh, 1234 triangles')).toBeInTheDocument()
		expect(within(link).getByText('100.3 × 20 × 0 mm')).toBeInTheDocument()
		expect(screen.getByText('Degrees of freedom')).toBeInTheDocument()
		expect(screen.getByText('6')).toBeInTheDocument()
	})

	it('shows a primitive link by shape and dimensions in mm instead of triangles', () => {
		render(KinematicsReport, {
			props: {
				report: report({
					links: [
						new LinkReport({
							id: 'pad',
							primitive: new Primitive({
								shape: { case: 'box', value: new Primitive_Box({ x: 10, y: 20.26, z: 30 }) },
							}),
						}),
						new LinkReport({
							id: 'wheel',
							primitive: new Primitive({
								shape: {
									case: 'cylinder',
									value: new Primitive_Cylinder({ radius: 5, length: 12 }),
								},
							}),
						}),
					],
				}),
			},
		})
		const pad = screen.getByText('pad').closest('li')!
		expect(within(pad).getByText('Box 10 × 20.3 × 30 mm')).toBeInTheDocument()
		expect(pad).not.toHaveTextContent('triangles')
		const wheel = screen.getByText('wheel').closest('li')!
		expect(wheel).toHaveTextContent('Cylinder r 5, length 12 mm')
	})
})
