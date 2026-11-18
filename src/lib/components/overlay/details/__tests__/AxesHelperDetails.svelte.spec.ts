import { render, screen } from '@testing-library/svelte'
import { createWorld } from 'koota'
import '@testing-library/jest-dom/vitest'
import { describe, expect, it } from 'vitest'

import { WORLD_CONTEXT_KEY } from '$lib/ecs/useWorld'

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
})
