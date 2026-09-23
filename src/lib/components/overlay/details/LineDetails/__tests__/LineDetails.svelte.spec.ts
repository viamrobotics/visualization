import { screen } from '@testing-library/svelte'
import { createWorld } from 'koota'
import '@testing-library/jest-dom/vitest'
import { describe, expect, it } from 'vitest'

import { renderWithWorld } from '$lib/__tests__/__fixtures__/renderWithWorld'
import { traits } from '$lib/ecs'

import LineDetails from '../LineDetails.svelte'

describe('LineDetails', () => {
	const world = createWorld()

	it('renders line positions section when entity has LinePositions trait', () => {
		const entity = world.spawn(traits.LinePositions(new Float32Array([0, 0, 0, 1, 1, 1, 2, 2, 2])))
		renderWithWorld(LineDetails, {
			world,
			props: { entity },
		})
		expect(screen.getByLabelText('mutable line positions')).toBeInTheDocument()
	})

	it('renders nothing when entity has no LinePositions trait', () => {
		const entity = world.spawn()
		renderWithWorld(LineDetails, {
			world,
			props: { entity },
		})
		expect(screen.queryByLabelText('mutable line positions')).not.toBeInTheDocument()
	})
})
