import { render, screen } from '@testing-library/svelte'
import { createWorld } from 'koota'
import { describe, expect, it } from 'vitest'
import '@testing-library/jest-dom/vitest'

import WithWorld from '$lib/__tests__/__fixtures__/WithWorld.svelte'
import { traits } from '$lib/ecs'
import { Pose } from '$lib/math'

import PoseDetails from '../PoseDetails.svelte'

describe('PoseDetails', () => {
	const world = createWorld()

	it('always renders parent, world position, and world orientation sections', () => {
		const entity = world.spawn()
		render(WithWorld, {
			props: { world, component: PoseDetails, props: { entity, editable: true } },
		})
		expect(screen.getByText('parent frame')).toBeInTheDocument()
		expect(screen.getByText('world position')).toBeInTheDocument()
		expect(screen.getByText('world orientation')).toBeInTheDocument()
	})

	it('renders local position and orientation when entity has a Matrix', () => {
		const matrix = new Pose(1, 2, 3, 0.6, 0.8, 0, 0.4).toMatrix4()

		const entity = world.spawn(traits.Matrix(matrix))
		render(WithWorld, {
			props: { world, component: PoseDetails, props: { entity, editable: true } },
		})
		expect(screen.getByLabelText('mutable local position')).toBeInTheDocument()
		expect(screen.getByLabelText('mutable local orientation')).toBeInTheDocument()
	})

	it('does not render local position/orientation when entity has no matrix or center', () => {
		const entity = world.spawn()
		render(WithWorld, {
			props: { world, component: PoseDetails, props: { entity, editable: true } },
		})
		expect(screen.queryByLabelText('mutable local position')).not.toBeInTheDocument()
		expect(screen.queryByLabelText('mutable local orientation')).not.toBeInTheDocument()
	})
})
