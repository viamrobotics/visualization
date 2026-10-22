import { render, screen } from '@testing-library/svelte'
import { createWorld } from 'koota'
import { describe, expect, it } from 'vitest'
import '@testing-library/jest-dom/vitest'

import { traits } from '$lib/ecs'
import { WORLD_CONTEXT_KEY } from '$lib/ecs/useWorld'

import GeometryOffsetDetails from '../GeometryOffsetDetails.svelte'

describe('GeometryOffsetDetails', () => {
	const world = createWorld()

	const renderFor = (entity: ReturnType<typeof world.spawn>) =>
		render(GeometryOffsetDetails, {
			props: { entity },
			context: new Map([[WORLD_CONTEXT_KEY, world]]),
		})

	it('shows a frame geometry offset read-only', () => {
		const entity = world.spawn(
			traits.FramesAPI,
			traits.Center({ x: 257.5, y: 235, z: 0, oX: 0, oY: 0, oZ: 1, theta: 90 })
		)

		renderFor(entity)

		expect(screen.getByText('geometry offset').parentElement).toHaveTextContent(
			'x 257.50 y 235.00 z 0.00'
		)
		expect(screen.getByText('geometry orientation').parentElement).toHaveTextContent(
			'ox 0.00 oy 0.00 oz 1.00 th 90.00'
		)
		expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
	})

	it('shows nothing for a frame geometry at the frame origin', () => {
		const entity = world.spawn(
			traits.FramesAPI,
			traits.Center({ x: 0, y: 0, z: 0, oX: 0, oY: 0, oZ: 1, theta: 0 })
		)

		renderFor(entity)

		expect(screen.queryByText('geometry offset')).not.toBeInTheDocument()
	})

	it('shows nothing for a drawing, whose displayed pose already includes its center', () => {
		const entity = world.spawn(traits.Center({ x: 100, y: 0, z: 0, oX: 0, oY: 0, oZ: 1, theta: 0 }))

		renderFor(entity)

		expect(screen.queryByText('geometry offset')).not.toBeInTheDocument()
	})
})
