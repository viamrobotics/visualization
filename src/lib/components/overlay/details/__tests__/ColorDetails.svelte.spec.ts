import { render, screen } from '@testing-library/svelte'
import { createWorld } from 'koota'
import '@testing-library/jest-dom/vitest'
import { describe, expect, it } from 'vitest'

import { traits } from '#lib/ecs/index.js'
import { WORLD_CONTEXT_KEY } from '#lib/ecs/useWorld.js'

import ColorDetails from '../ColorDetails.svelte'

describe('ColorDetails', () => {
	const world = createWorld()

	it('renders color section when entity has Color trait', () => {
		const entity = world.spawn(traits.Color({ r: 1, g: 0, b: 0 }))
		render(ColorDetails, {
			props: { entity },
			context: new Map([[WORLD_CONTEXT_KEY, world]]),
		})
		expect(screen.getByText('color')).toBeInTheDocument()
	})

	it('renders nothing when entity has no Color trait', () => {
		const entity = world.spawn()
		render(ColorDetails, {
			props: { entity },
			context: new Map([[WORLD_CONTEXT_KEY, world]]),
		})
		expect(screen.queryByText('color')).not.toBeInTheDocument()
	})
})
