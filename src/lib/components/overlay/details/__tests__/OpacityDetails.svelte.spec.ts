import { render, screen } from '@testing-library/svelte'
import { createWorld } from 'koota'
import '@testing-library/jest-dom/vitest'
import { describe, expect, it } from 'vitest'

import { enterNumber, numberField } from '#lib/__tests__/__fixtures__/numberFields.js'
import { traits } from '#lib/ecs/index.js'
import { WORLD_CONTEXT_KEY } from '#lib/ecs/useWorld.js'

import OpacityDetails from '../OpacityDetails.svelte'

describe('OpacityDetails', () => {
	const world = createWorld()

	it('renders the opacity slider', () => {
		const entity = world.spawn()
		render(OpacityDetails, {
			props: { entities: [entity] },
			context: new Map([[WORLD_CONTEXT_KEY, world]]),
		})
		expect(screen.getByRole('slider', { name: 'opacity' })).toBeInTheDocument()
	})

	it('clamps a typed opacity below the slider range to 0', async () => {
		const entity = world.spawn()
		render(OpacityDetails, {
			props: { entities: [entity] },
			context: new Map([[WORLD_CONTEXT_KEY, world]]),
		})

		await enterNumber(numberField('opacity'), '-1')

		expect(entity.get(traits.OpacityOverride)).toBe(0)
	})
})
