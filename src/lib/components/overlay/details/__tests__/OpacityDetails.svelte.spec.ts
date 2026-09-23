import { screen } from '@testing-library/svelte'
import { createWorld } from 'koota'
import '@testing-library/jest-dom/vitest'
import { describe, expect, it } from 'vitest'

import { renderWithWorld } from '$lib/__tests__/__fixtures__/renderWithWorld'
import { traits } from '$lib/ecs'

import OpacityDetails from '../OpacityDetails.svelte'

describe('OpacityDetails', () => {
	const world = createWorld()

	it('renders the opacity slider', () => {
		const entity = world.spawn()
		renderWithWorld(OpacityDetails, {
			world,
			props: { entity },
		})
		expect(screen.getByText('opacity')).toBeInTheDocument()
		expect(screen.getByLabelText('mutable opacity')).toBeInTheDocument()
	})

	it('renders for entities with an Opacity trait', () => {
		const entity = world.spawn(traits.Opacity(0.4))
		renderWithWorld(OpacityDetails, {
			world,
			props: { entity },
		})
		expect(screen.getByLabelText('mutable opacity')).toBeInTheDocument()
	})
})
