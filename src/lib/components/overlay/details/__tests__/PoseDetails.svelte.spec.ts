import { render, screen } from '@testing-library/svelte'
import { createWorld } from 'koota'
import { describe, expect, it } from 'vitest'
import '@testing-library/jest-dom/vitest'

import { traits } from '$lib/ecs'
import { WORLD_CONTEXT_KEY } from '$lib/ecs/useWorld'
import { Pose } from '$lib/math'

import PoseDetails from '../PoseDetails.svelte'

describe('PoseDetails', () => {
	const world = createWorld()

	it('always renders parent, world position, and world orientation sections', () => {
		const entity = world.spawn()
		render(PoseDetails, {
			props: { entity, editable: true },
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
			props: { entity, editable: true },
			context: new Map([[WORLD_CONTEXT_KEY, world]]),
		})
		expect(screen.getByLabelText('mutable local position')).toBeInTheDocument()
		expect(screen.getByLabelText('mutable local orientation')).toBeInTheDocument()
	})

	it('folds a drawn geometry center into the local and world poses', () => {
		const identity = new Pose().toMatrix4()
		const entity = world.spawn(
			traits.Matrix(identity),
			traits.WorldMatrix(identity.clone()),
			traits.Center({ x: 100, y: 200, z: 300, oX: 0, oY: 0, oZ: 1, theta: 0 })
		)
		render(PoseDetails, {
			props: { entity, editable: false },
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
			props: { entity, editable: false },
			context: new Map([[WORLD_CONTEXT_KEY, world]]),
		})

		expect(
			screen.getByLabelText('immutable local position x coordinate').parentElement
		).toHaveTextContent('0.00')
		expect(screen.getByText('world position').parentElement).toHaveTextContent(
			'x 0.00 y 0.00 z 0.00'
		)
	})

	it('does not render local position/orientation when entity has no matrix or center', () => {
		const entity = world.spawn()
		render(PoseDetails, {
			props: { entity, editable: true },
			context: new Map([[WORLD_CONTEXT_KEY, world]]),
		})
		expect(screen.queryByLabelText('mutable local position')).not.toBeInTheDocument()
		expect(screen.queryByLabelText('mutable local orientation')).not.toBeInTheDocument()
	})
})
