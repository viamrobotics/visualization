import { render, screen } from '@testing-library/svelte'
import { createWorld } from 'koota'
import '@testing-library/jest-dom/vitest'
import { describe, expect, it, vi } from 'vitest'

import { traits } from '#lib/ecs/index.js'
import { WORLD_CONTEXT_KEY } from '#lib/ecs/useWorld.js'

import WritingEffectHarness from './__fixtures__/WritingEffectHarness.svelte'

describe('useMappedEntitiesTraits', () => {
	it('lets an effect write a watched trait without re-running itself', () => {
		const world = createWorld()
		const entity = world.spawn(traits.Opacity(1))
		const onwrite = vi.fn()

		render(WritingEffectHarness, {
			props: { entity, onwrite },
			context: new Map([[WORLD_CONTEXT_KEY, world]]),
		})

		expect(onwrite, 'the write fed back into its own effect').toHaveBeenCalledTimes(1)
		expect(screen.getByText('0.5')).toBeInTheDocument()
	})
})
