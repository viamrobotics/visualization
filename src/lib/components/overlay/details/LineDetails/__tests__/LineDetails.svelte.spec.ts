import { render, screen } from '@testing-library/svelte'
import { createWorld } from 'koota'
import '@testing-library/jest-dom/vitest'
import { describe, expect, it } from 'vitest'

import { traits } from '#lib/ecs/index.js'
import { WORLD_CONTEXT_KEY } from '#lib/ecs/useWorld.js'

import LineDetails from '../LineDetails.svelte'

describe('LineDetails', () => {
	const world = createWorld()

	it('renders line positions section when entity has LinePositions trait', () => {
		const entity = world.spawn(traits.LinePositions(new Float32Array([0, 0, 0, 1, 1, 1, 2, 2, 2])))
		render(LineDetails, {
			props: { entity },
			context: new Map([[WORLD_CONTEXT_KEY, world]]),
		})
		expect(screen.getByLabelText('mutable line positions')).toBeInTheDocument()
	})

	it('renders nothing when entity has no LinePositions trait', () => {
		const entity = world.spawn()
		render(LineDetails, {
			props: { entity },
			context: new Map([[WORLD_CONTEXT_KEY, world]]),
		})
		expect(screen.queryByLabelText('mutable line positions')).not.toBeInTheDocument()
	})
})
