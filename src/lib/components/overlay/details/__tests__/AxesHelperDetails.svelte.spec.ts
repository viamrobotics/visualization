import { render, screen } from '@testing-library/svelte'
import { createWorld } from 'koota'
import '@testing-library/jest-dom/vitest'
import { describe, expect, it } from 'vitest'

import WithWorld from '$lib/__tests__/__fixtures__/WithWorld.svelte'
import { traits } from '$lib/ecs'

import AxesHelperDetails from '../AxesHelperDetails.svelte'

describe('AxesHelperDetails', () => {
	const world = createWorld()

	it('renders the show axes helper toggle', () => {
		const entity = world.spawn()
		render(WithWorld, {
			props: { world, component: AxesHelperDetails, props: { entity } },
		})
		expect(screen.getByText('show axes helper')).toBeInTheDocument()
	})

	it('renders for entities that already have ShowAxesHelper', () => {
		const entity = world.spawn(traits.ShowAxesHelper)
		render(WithWorld, {
			props: { world, component: AxesHelperDetails, props: { entity } },
		})
		expect(screen.getByText('show axes helper')).toBeInTheDocument()
	})
})
