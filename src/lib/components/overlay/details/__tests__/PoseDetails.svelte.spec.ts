import { render, screen, within } from '@testing-library/svelte'
import userEvent from '@testing-library/user-event'
import { createWorld } from 'koota'
import { afterEach, describe, expect, it } from 'vitest'
import '@testing-library/jest-dom/vitest'

import { traits } from '#lib/ecs/index.js'
import { WORLD_CONTEXT_KEY } from '#lib/ecs/useWorld.js'
import { Pose } from '#lib/math/index.js'

import { ORIENTATION_FORMAT_KEY } from '../orientationFormat'
import PoseDetails from '../PoseDetails.svelte'

describe('PoseDetails', () => {
	const world = createWorld()

	it('always renders parent, world position, and world orientation sections', () => {
		const entity = world.spawn()
		render(PoseDetails, {
			props: { entities: [entity], editable: true },
			context: new Map([[WORLD_CONTEXT_KEY, world]]),
		})
		expect(screen.getByText('parent frame')).toBeInTheDocument()
		expect(screen.getByText('world position')).toBeInTheDocument()
		expect(screen.getByText('world orientation')).toBeInTheDocument()
	})

	it('renders local position and orientation when entity has a Matrix', () => {
		const matrix = new Pose(1, 2, 3, 0.6, 0.8, 0, 0.4).toMatrix4()

		const entity = world.spawn(traits.Matrix(matrix))
		render(PoseDetails, {
			props: { entities: [entity], editable: true },
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
			render(PoseDetails, {
				props: { entities: [world.spawn(traits.Matrix(new Pose().toMatrix4()))], editable: true },
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

	it('folds a drawn geometry center into the local and world poses', () => {
		const identity = new Pose().toMatrix4()
		const entity = world.spawn(
			traits.Matrix(identity),
			traits.WorldMatrix(identity.clone()),
			traits.Center({ x: 100, y: 200, z: 300, oX: 0, oY: 0, oZ: 1, theta: 0 })
		)
		render(PoseDetails, {
			props: { entities: [entity], editable: false },
			context: new Map([[WORLD_CONTEXT_KEY, world]]),
		})

		expect(
			screen.getByLabelText('immutable local position x coordinate').parentElement
		).toHaveTextContent('100.00')
		expect(screen.getByText('world position').parentElement).toHaveTextContent(
			'x 100.00 y 200.00 z 300.00'
		)
	})

	it('keeps a reference frame pose separate from its geometry center', () => {
		const identity = new Pose().toMatrix4()
		const entity = world.spawn(
			traits.Matrix(identity),
			traits.WorldMatrix(identity.clone()),
			traits.Center({ x: 100, y: 200, z: 300, oX: 0, oY: 0, oZ: 1, theta: 0 }),
			traits.FramesAPI
		)
		render(PoseDetails, {
			props: { entities: [entity], editable: false },
			context: new Map([[WORLD_CONTEXT_KEY, world]]),
		})

		expect(
			screen.getByLabelText('immutable local position x coordinate').parentElement
		).toHaveTextContent('0.00')
		expect(screen.getByText('world position').parentElement).toHaveTextContent(
			'x 0.00 y 0.00 z 0.00'
		)
	})

	it('reads an entity with no matrix or center as the origin, where it renders', () => {
		const entity = world.spawn()
		render(PoseDetails, {
			props: { entities: [entity], editable: false },
			context: new Map([[WORLD_CONTEXT_KEY, world]]),
		})
		expect(
			screen.getByLabelText('immutable local position x coordinate').parentElement
		).toHaveTextContent('0.00')
		expect(
			screen.getByLabelText('immutable local orientation z coordinate').parentElement
		).toHaveTextContent('1.00')
	})

	it('shows the world pose as dashes when only some selected entities have a world transform', () => {
		const identity = new Pose().toMatrix4()
		const placed = world.spawn(traits.Matrix(identity), traits.WorldMatrix(identity.clone()))
		const unresolved = world.spawn(traits.Matrix(identity.clone()))
		render(PoseDetails, {
			props: { entities: [placed, unresolved], editable: false },
			context: new Map([[WORLD_CONTEXT_KEY, world]]),
		})
		expect(screen.getByText('world position').parentElement).toHaveTextContent('x - y - z -')
	})

	it('shows a dash for an axis the selected entities differ on, and the shared value otherwise', () => {
		const first = world.spawn(traits.Matrix(new Pose(100, 50, 0).toMatrix4()))
		const second = world.spawn(traits.Matrix(new Pose(200, 50, 0).toMatrix4()))
		render(PoseDetails, {
			props: { entities: [first, second], editable: false },
			context: new Map([[WORLD_CONTEXT_KEY, world]]),
		})
		expect(
			screen.getByLabelText('immutable local position x coordinate').parentElement
		).toHaveTextContent('-')
		expect(
			screen.getByLabelText('immutable local position y coordinate').parentElement
		).toHaveTextContent('50.00')
	})
})
