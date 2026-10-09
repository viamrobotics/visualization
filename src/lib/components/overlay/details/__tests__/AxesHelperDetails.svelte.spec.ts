import { render, screen } from '@testing-library/svelte'
import { createWorld } from 'koota'
import '@testing-library/jest-dom/vitest'
import { describe, expect, it } from 'vitest'

import { traits } from '#lib/ecs/index.js'
import { WORLD_CONTEXT_KEY } from '#lib/ecs/useWorld.js'

import AxesHelperDetails from '../AxesHelperDetails.svelte'

describe('AxesHelperDetails', () => {
	const world = createWorld()

	it('renders the show axes helper toggle', () => {
		const entity = world.spawn()
		render(AxesHelperDetails, {
			props: { entity },
			context: new Map([[WORLD_CONTEXT_KEY, world]]),
		})
		expect(screen.getByText('show axes helper')).toBeInTheDocument()
	})

	it('renders for entities that already have ShowAxesHelper', () => {
		const entity = world.spawn(traits.ShowAxesHelper)
		render(AxesHelperDetails, {
			props: { entity },
			context: new Map([[WORLD_CONTEXT_KEY, world]]),
		})
		expect(screen.getByText('show axes helper')).toBeInTheDocument()
	})
})
