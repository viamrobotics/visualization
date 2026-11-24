import { render, screen } from '@testing-library/svelte'
import { createWorld } from 'koota'
import '@testing-library/jest-dom/vitest'
import { describe, expect, it } from 'vitest'

import { WORLD_CONTEXT_KEY } from '#lib/ecs/useWorld.js'

import OpacityDetails from '../OpacityDetails.svelte'

describe('OpacityDetails', () => {
	const world = createWorld()

	it('renders the opacity slider', () => {
		const entity = world.spawn()
		render(OpacityDetails, {
			props: { entities: [entity] },
			context: new Map([[WORLD_CONTEXT_KEY, world]]),
		})
		expect(screen.getByRole('slider', { name: 'opacity' })).toBeInTheDocument()
	})
})
