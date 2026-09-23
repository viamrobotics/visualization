import { render, screen } from '@testing-library/svelte'
import { createWorld } from 'koota'
import '@testing-library/jest-dom/vitest'
import { describe, expect, it } from 'vitest'

import WithWorld from '$lib/__tests__/__fixtures__/WithWorld.svelte'
import { traits } from '$lib/ecs'

import OpacityDetails from '../OpacityDetails.svelte'

describe('OpacityDetails', () => {
	const world = createWorld()

	it('renders the opacity slider', () => {
		const entity = world.spawn()
		render(WithWorld, {
			props: { world, component: OpacityDetails, props: { entity } },
		})
		expect(screen.getByText('opacity')).toBeInTheDocument()
		expect(screen.getByLabelText('mutable opacity')).toBeInTheDocument()
	})

	it('renders for entities with an Opacity trait', () => {
		const entity = world.spawn(traits.Opacity(0.4))
		render(WithWorld, {
			props: { world, component: OpacityDetails, props: { entity } },
		})
		expect(screen.getByLabelText('mutable opacity')).toBeInTheDocument()
	})
})
