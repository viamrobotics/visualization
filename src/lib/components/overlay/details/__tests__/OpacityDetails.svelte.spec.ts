import { render, screen } from '@testing-library/svelte'
import { createWorld } from 'koota'
import '@testing-library/jest-dom/vitest'
import { describe, expect, it } from 'vitest'

import { WORLD_CONTEXT_KEY } from '$lib/ecs/useWorld'

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
})
