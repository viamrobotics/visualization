import { render, screen, waitFor } from '@testing-library/svelte'
import userEvent from '@testing-library/user-event'
import '@testing-library/jest-dom/vitest'
import { describe, expect, it, vi } from 'vitest'

import KinematicsAddMenu from '../KinematicsAddMenu.svelte'

describe('<KinematicsAddMenu>', () => {
	it('lists Add files and Add folder in the menu', async () => {
		render(KinematicsAddMenu, { props: { onfiles: vi.fn() } })
		await userEvent.click(screen.getByRole('button', { name: 'Add' }))
		expect(await screen.findByRole('menuitem', { name: 'Add files' })).toBeInTheDocument()
		expect(screen.getByRole('menuitem', { name: 'Add folder' })).toBeInTheDocument()
	})

	it.each(['Add files', 'Add folder', 'Import URDF or ROS package'])(
		'draws an icon for %s',
		async (name) => {
			render(KinematicsAddMenu, { props: { onfiles: vi.fn() } })
			await userEvent.click(screen.getByRole('button', { name: 'Add' }))

			const item = await screen.findByRole('menuitem', { name })

			expect(item.querySelector('svg path'), `${name} icon path`).not.toBeNull()
		}
	)

	it('accepts OBJ and DAE meshes', () => {
		render(KinematicsAddMenu, { props: { onfiles: vi.fn() } })

		const accept = screen.getByTestId('kinematics-files-input').getAttribute('accept')
		expect(accept).toContain('.obj')
		expect(accept).toContain('.dae')
	})

	it('passes picked files to onfiles', async () => {
		const onfiles = vi.fn()
		render(KinematicsAddMenu, { props: { onfiles } })

		const file = new File([new Uint8Array([1, 2, 3])], 'arm.stl')
		await userEvent.upload(screen.getByTestId('kinematics-files-input'), file)

		await waitFor(() => expect(onfiles).toHaveBeenCalledTimes(1))
		const [files] = onfiles.mock.calls[0] as [{ name: string }[]]
		expect(files.map((entry) => entry.name)).toEqual(['arm.stl'])
	})

	it('keeps the hidden inputs out of the accessibility tree', () => {
		render(KinematicsAddMenu, { props: { onfiles: vi.fn() } })
		expect(screen.getByTestId('kinematics-files-input')).toHaveAttribute('aria-hidden', 'true')
		expect(screen.getByTestId('kinematics-folder-input')).toHaveAttribute('aria-hidden', 'true')
	})

	it('lists Import URDF or ROS package and routes its folder files to onfiles', async () => {
		const onfiles = vi.fn()
		render(KinematicsAddMenu, { props: { onfiles } })
		await userEvent.click(screen.getByRole('button', { name: 'Add' }))
		expect(
			await screen.findByRole('menuitem', { name: 'Import URDF or ROS package' })
		).toBeInTheDocument()

		const urdf = new File(['<robot/>'], 'robot.urdf')
		await userEvent.upload(screen.getByTestId('kinematics-urdf-input'), urdf)
		await waitFor(() => expect(onfiles).toHaveBeenCalledTimes(1))
		const [files] = onfiles.mock.calls[0] as [{ name: string }[]]
		expect(files.map((entry) => entry.name)).toEqual(['robot.urdf'])
	})
})
