import { createWorld } from 'koota'
import { provideWorld as provideKootaWorld } from 'koota/svelte'

import * as relations from './relations'
import * as traits from './traits'

export { useWorld } from 'koota/svelte'

export function provideWorld() {
	const world = createWorld()

	// @ts-expect-error This is for debugging.
	globalThis.__koota__ = {
		world,
		traits,
		relations,
	}

	return provideKootaWorld(world)
}
