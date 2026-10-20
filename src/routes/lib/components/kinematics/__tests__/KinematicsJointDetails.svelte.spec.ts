import { render, screen } from '@testing-library/svelte'
import userEvent from '@testing-library/user-event'
import '@testing-library/jest-dom/vitest'
import { describe, expect, it, vi } from 'vitest'

import { Joint, JointType, Mimic } from '$lib/buf/kinematics/v1/spec_pb'

import KinematicsJointDetails from '../KinematicsJointDetails.svelte'
import { detailsWorkbench, elbow, shoulder } from './__fixtures__/kinematicsDetailsWorkbench'

describe('<KinematicsJointDetails>', () => {
	it('offers no descendant or itself as a parent', () => {
		render(KinematicsJointDetails, {
			props: { workbench: detailsWorkbench(), joint: shoulder, select: vi.fn() },
		})

		const parent = screen.getByRole('combobox', { name: 'Parent' })
		expect([...parent.querySelectorAll('option')].map((option) => option.value)).toEqual([''])
	})

	it('drives the input in radians from a degrees slider', async () => {
		const workbench = detailsWorkbench()
		render(KinematicsJointDetails, {
			props: { workbench, joint: shoulder, select: vi.fn() },
		})
		await vi.waitFor(() =>
			expect(screen.getByLabelText('mutable Position').querySelector('input')).not.toBeNull()
		)

		const input = screen.getByLabelText('mutable Position').querySelector('input')!
		await userEvent.tripleClick(input)
		await userEvent.keyboard('30{Tab}')

		await vi.waitFor(() => expect(workbench.setInput).toHaveBeenCalled())
		const [index, value] = vi.mocked(workbench.setInput).mock.calls.at(-1)!
		expect(index).toBe(0)
		expect(value).toBeCloseTo(Math.PI / 6, 5)
	})

	it('shows limits for a driven joint and hides them for a mimic', () => {
		const { unmount } = render(KinematicsJointDetails, {
			props: { workbench: detailsWorkbench(), joint: shoulder, select: vi.fn() },
		})
		expect(screen.getByLabelText('mutable Lower')).toBeInTheDocument()
		expect(screen.getByLabelText('mutable Upper')).toBeInTheDocument()
		unmount()

		const mimic = new Joint({
			id: elbow.id,
			type: JointType.PRISMATIC,
			mimic: new Mimic({ joint: 'shoulder', multiplier: 1, offset: 0 }),
		})
		render(KinematicsJointDetails, {
			props: { workbench: detailsWorkbench(), joint: mimic, select: vi.fn() },
		})
		expect(screen.queryByLabelText('mutable Lower')).not.toBeInTheDocument()
		expect(screen.queryByLabelText('mutable Upper')).not.toBeInTheDocument()
		expect(screen.getByLabelText('mutable Multiplier')).toBeInTheDocument()
	})

	it('adds a child joint at this joint and selects it', async () => {
		const workbench = detailsWorkbench()
		const select = vi.fn()
		render(KinematicsJointDetails, { props: { workbench, joint: shoulder, select } })

		await userEvent.click(screen.getByRole('button', { name: 'Add child joint' }))

		expect(workbench.addJoint).toHaveBeenCalledWith({
			parent: 'shoulder',
			origin: shoulder.origin,
		})
		expect(select).toHaveBeenCalledWith('new-joint')
	})

	it('removes the joint', async () => {
		const workbench = detailsWorkbench()
		render(KinematicsJointDetails, {
			props: { workbench, joint: shoulder, select: vi.fn() },
		})

		await userEvent.click(screen.getByRole('button', { name: 'Remove joint' }))

		expect(workbench.removeJoint).toHaveBeenCalledWith('shoulder')
	})
})
