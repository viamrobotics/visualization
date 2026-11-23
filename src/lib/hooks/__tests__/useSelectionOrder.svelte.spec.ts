import { render, screen } from '@testing-library/svelte'
import { createWorld } from 'koota'
import { flushSync } from 'svelte'
import '@testing-library/jest-dom/vitest'
import { describe, expect, it } from 'vitest'

import { traits } from '#lib/ecs/index.js'
import { WORLD_CONTEXT_KEY } from '#lib/ecs/useWorld.js'

import SelectionOrderHarness from './__fixtures__/SelectionOrderHarness.svelte'

describe('provideSelectionOrder', () => {
	it('moves a deselected and reselected entity to the end, after the ones still selected', () => {
		const world = createWorld()
		const [a, b, c] = ['a', 'b', 'c'].map((name) => world.spawn(traits.Name(name)))
		render(SelectionOrderHarness, { context: new Map([[WORLD_CONTEXT_KEY, world]]) })
		for (const entity of [a, b, c]) entity?.add(traits.Selected)

		a?.remove(traits.Selected)
		a?.add(traits.Selected)
		flushSync()

		expect(screen.getByTestId('selection-order')).toHaveTextContent('b,c,a')
	})
})
