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
