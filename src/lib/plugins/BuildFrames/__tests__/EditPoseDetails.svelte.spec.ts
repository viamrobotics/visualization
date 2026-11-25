import { render, screen, within } from '@testing-library/svelte'
import userEvent from '@testing-library/user-event'
import { createWorld } from 'koota'
import { afterEach, describe, expect, it } from 'vitest'
import '@testing-library/jest-dom/vitest'

import { ORIENTATION_FORMAT_KEY } from '#lib/components/overlay/details/orientationFormat.js'
import { traits } from '#lib/ecs/index.js'
import { WORLD_CONTEXT_KEY } from '#lib/ecs/useWorld.js'
import { Pose } from '#lib/math/index.js'

import EditPoseDetails from '../EditPoseDetails.svelte'

describe('EditPoseDetails', () => {
	const world = createWorld()

	it('renders local position and orientation as fields when entity has a Matrix', () => {
		const matrix = new Pose(1, 2, 3, 0.6, 0.8, 0, 0.4).toMatrix4()

		const entity = world.spawn(traits.Matrix(matrix))
		render(EditPoseDetails, {
			props: { entities: [entity] },
			context: new Map([[WORLD_CONTEXT_KEY, world]]),
		})
		const position = within(screen.getByRole('group', { name: 'local position (mm)' }))
		expect(position.getByRole('spinbutton', { name: 'X' })).toHaveValue(1)
		expect(position.getByRole('spinbutton', { name: 'Y' })).toHaveValue(2)
		expect(position.getByRole('spinbutton', { name: 'Z' })).toHaveValue(3)
		expect(
			screen.getByRole('group', { name: 'local orientation (Euler, deg)' })
		).toBeInTheDocument()
	})

	describe('orientation format', () => {
		afterEach(() => localStorage.removeItem(ORIENTATION_FORMAT_KEY))

		const renderPose = () =>
			render(EditPoseDetails, {
				props: { entities: [world.spawn(traits.Matrix(new Pose().toMatrix4()))] },
				context: new Map([[WORLD_CONTEXT_KEY, world]]),
			})

		it('opens on Euler angles', () => {
			renderPose()

			expect(screen.getByRole('tab', { name: 'Euler (deg)' })).toHaveAttribute(
				'aria-selected',
				'true'
			)
		})

		it('keeps the picked format for the next panel', async () => {
			const { unmount } = renderPose()
			await userEvent.click(screen.getByRole('tab', { name: 'OV (deg)' }))
			unmount()

			renderPose()

			expect(screen.getByRole('tab', { name: 'OV (deg)' })).toHaveAttribute('aria-selected', 'true')
		})
	})
})
