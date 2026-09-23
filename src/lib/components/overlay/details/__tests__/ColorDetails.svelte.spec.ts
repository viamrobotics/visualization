import { screen } from '@testing-library/svelte'
import { createWorld } from 'koota'
import '@testing-library/jest-dom/vitest'
import { describe, expect, it } from 'vitest'

import { renderWithWorld } from '$lib/__tests__/__fixtures__/renderWithWorld'
import { traits } from '$lib/ecs'

import ColorDetails from '../ColorDetails.svelte'

describe('ColorDetails', () => {
	const world = createWorld()

	it('renders color section when entity has Color trait', () => {
		const entity = world.spawn(traits.Color({ r: 1, g: 0, b: 0 }))
		renderWithWorld(ColorDetails, {
			world,
			props: { entity },
		})
		expect(screen.getByText('color')).toBeInTheDocument()
	})

	it('renders nothing when entity has no Color trait', () => {
		const entity = world.spawn()
		renderWithWorld(ColorDetails, {
			world,
			props: { entity },
		})
		expect(screen.queryByText('color')).not.toBeInTheDocument()
	})
})
