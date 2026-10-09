import { render, screen } from '@testing-library/svelte'
import { createWorld } from 'koota'
import '@testing-library/jest-dom/vitest'
import { describe, expect, it } from 'vitest'

import { traits } from '#lib/ecs/index.js'
import { WORLD_CONTEXT_KEY } from '#lib/ecs/useWorld.js'

import OpacityDetails from '../OpacityDetails.svelte'

describe('OpacityDetails', () => {
	const world = createWorld()

	it('renders the opacity slider', () => {
		const entity = world.spawn()
		render(OpacityDetails, {
			props: { entity },
			context: new Map([[WORLD_CONTEXT_KEY, world]]),
		})
		expect(screen.getByText('opacity')).toBeInTheDocument()
		expect(screen.getByLabelText('mutable opacity')).toBeInTheDocument()
	})

	it('renders for entities with an Opacity trait', () => {
		const entity = world.spawn(traits.Opacity(0.4))
		render(OpacityDetails, {
			props: { entity },
			context: new Map([[WORLD_CONTEXT_KEY, world]]),
		})
		expect(screen.getByLabelText('mutable opacity')).toBeInTheDocument()
	})
})
