import { screen } from '@testing-library/svelte'
import { createWorld } from 'koota'
import '@testing-library/jest-dom/vitest'
import { describe, expect, it } from 'vitest'

import { renderWithWorld } from '$lib/__tests__/__fixtures__/renderWithWorld'
import { traits } from '$lib/ecs'

import AxesHelperDetails from '../AxesHelperDetails.svelte'

describe('AxesHelperDetails', () => {
	const world = createWorld()

	it('renders the show axes helper toggle', () => {
		const entity = world.spawn()
		renderWithWorld(AxesHelperDetails, {
			world,
			props: { entity },
		})
		expect(screen.getByText('show axes helper')).toBeInTheDocument()
	})

	it('renders for entities that already have ShowAxesHelper', () => {
		const entity = world.spawn(traits.ShowAxesHelper)
		renderWithWorld(AxesHelperDetails, {
			world,
			props: { entity },
		})
		expect(screen.getByText('show axes helper')).toBeInTheDocument()
	})
})
