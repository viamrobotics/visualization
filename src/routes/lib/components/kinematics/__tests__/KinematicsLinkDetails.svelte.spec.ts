import { render, screen } from '@testing-library/svelte'
import userEvent from '@testing-library/user-event'
import '@testing-library/jest-dom/vitest'
import { describe, expect, it, vi } from 'vitest'

import { Pose } from '$lib/buf/common/v1/common_pb'
import {
	Link,
	LinkReport,
	Primitive,
	Primitive_Box,
	ValidationReport,
} from '$lib/buf/kinematics/v1/spec_pb'

import KinematicsLinkDetails from '../KinematicsLinkDetails.svelte'
import { arm, detailsWorkbench } from './__fixtures__/kinematicsDetailsWorkbench'

const waitForInputs = (label: string) =>
	vi.waitFor(() =>
		expect(
			screen.getByLabelText(label).querySelectorAll('.tp-pndtxtv input').length
		).toBeGreaterThan(0)
	)

const linkAt = (z: number, parent = 'shoulder') =>
	new Link({
		id: arm.id,
		meshPath: arm.meshPath,
		parent,
		origin: new Pose({ x: 0, y: 0, z, oX: 0, oY: 0, oZ: 1, theta: 0 }),
	})

describe('<KinematicsLinkDetails>', () => {
	it('reparents without touching the origin', async () => {
		const workbench = detailsWorkbench()
		render(KinematicsLinkDetails, { props: { workbench, link: arm, select: vi.fn() } })

		await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Parent' }), 'elbow')

		expect(workbench.updateLink).toHaveBeenCalledWith('arm', { parent: 'elbow' })
	})

	it('names root as the empty parent', () => {
		render(KinematicsLinkDetails, {
			props: { workbench: detailsWorkbench(), link: arm, select: vi.fn() },
		})

		expect(screen.getByRole('option', { name: 'root' })).toBeInTheDocument()
	})

	it('writes the assembly pose when the origin is edited', async () => {
		const workbench = detailsWorkbench()
		render(KinematicsLinkDetails, {
			props: { workbench, link: linkAt(340), select: vi.fn() },
		})
		await waitForInputs('mutable Origin position')

		// The link sits at assembly z 340, which is local z 40 under a joint at z 300.
		const inputs = screen
			.getByLabelText('mutable Origin position')
			.querySelectorAll<HTMLInputElement>('.tp-pndtxtv input')
		expect(Number(inputs[2]!.value)).toBeCloseTo(40, 3)

		await userEvent.tripleClick(inputs[2]!)
		await userEvent.keyboard('50{Tab}')

		await vi.waitFor(() => expect(workbench.updateLink).toHaveBeenCalled())
		const patch = vi.mocked(workbench.updateLink).mock.calls.at(-1)![1]
		expect(patch.origin?.z).toBeCloseTo(350, 3)
		expect(patch.parent).toBeUndefined()
	})

	it('adds a joint at the link and moves the link onto it', async () => {
		const workbench = detailsWorkbench()
		const select = vi.fn()
		render(KinematicsLinkDetails, {
			props: { workbench, link: linkAt(340), select },
		})

		await userEvent.click(screen.getByRole('button', { name: 'Add joint for this link' }))

		expect(workbench.addJoint).toHaveBeenCalledWith({
			parent: 'shoulder',
			origin: { x: 0, y: 0, z: 340, oX: 0, oY: 0, oZ: 1, theta: 0 },
		})
		expect(workbench.updateLink).toHaveBeenCalledWith('arm', { parent: 'new-joint' })
		expect(select).toHaveBeenCalledWith('new-joint')
	})

	it('removes the link', async () => {
		const workbench = detailsWorkbench()
		render(KinematicsLinkDetails, { props: { workbench, link: arm, select: vi.fn() } })

		await userEvent.click(screen.getByRole('button', { name: 'Remove link' }))

		expect(workbench.removeLink).toHaveBeenCalledWith('arm')
	})

	describe('primitive link', () => {
		const box = new Link({
			id: 'arm',
			parent: 'shoulder',
			primitive: new Primitive({
				shape: { case: 'box', value: new Primitive_Box({ x: 10, y: 20, z: 30 }) },
			}),
		})

		it('shows the shape and dimensions read-only', () => {
			render(KinematicsLinkDetails, {
				props: { workbench: detailsWorkbench(), link: box, select: vi.fn() },
			})

			expect(screen.getByText('Box 10 × 20 × 30 mm')).toBeInTheDocument()
		})

		it('hides the mesh controls', () => {
			render(KinematicsLinkDetails, {
				props: { workbench: detailsWorkbench(), link: box, select: vi.fn() },
			})

			for (const name of ['Mesh file', 'Mesh units', 'Up axis', 'Collision']) {
				expect(screen.queryByRole('group', { name })).not.toBeInTheDocument()
			}
			expect(screen.queryByText('Max triangles')).not.toBeInTheDocument()
			expect(screen.queryByRole('button', { name: /Replace file/ })).not.toBeInTheDocument()
		})

		it('keeps the mesh controls on a mesh link', () => {
			render(KinematicsLinkDetails, {
				props: { workbench: detailsWorkbench(), link: arm, select: vi.fn() },
			})

			expect(screen.getByRole('group', { name: 'Mesh file' })).toBeInTheDocument()
			expect(screen.queryByText(/^Shape$/)).not.toBeInTheDocument()
		})
	})

	describe('over the triangle limit', () => {
		const withReport = (overTriangleLimit: boolean) =>
			detailsWorkbench({
				report: new ValidationReport({
					links: [
						new LinkReport({
							id: 'arm',
							triangles: 9000,
							overTriangleLimit,
							suggestedMaxTriangles: 5000,
						}),
					],
				}),
			})

		it('warns and simplifies the link', async () => {
			const workbench = withReport(true)
			render(KinematicsLinkDetails, { props: { workbench, link: arm, select: vi.fn() } })

			expect(
				screen.getByText('Collision mesh has 9000 triangles, over the limit of 5000.')
			).toBeInTheDocument()
			await userEvent.click(screen.getByRole('button', { name: 'Simplify' }))

			expect(workbench.simplify).toHaveBeenCalledWith('arm')
		})

		it('shows nothing when under the limit', () => {
			render(KinematicsLinkDetails, {
				props: { workbench: withReport(false), link: arm, select: vi.fn() },
			})

			expect(screen.queryByRole('button', { name: 'Simplify' })).not.toBeInTheDocument()
		})
	})
})
