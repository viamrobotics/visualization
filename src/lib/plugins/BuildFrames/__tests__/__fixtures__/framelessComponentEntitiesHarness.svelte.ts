import type { World } from 'koota'

import { flushSync } from 'svelte'

import { createFramelessComponentEntities } from '../../useFramelessComponentEntities.svelte'

export const createFramelessComponentEntitiesHarness = (
	world: World,
	initialNames: string[],
	initialActive = true
) => {
	let names = $state(initialNames)
	let active = $state(initialActive)

	let destroy!: () => void
	const disposeRoot = $effect.root(() => {
		destroy = createFramelessComponentEntities(
			world,
			() => active,
			() => names
		)
	})
	flushSync()

	return {
		destroy,
		disposeRoot,
		setNames: (next: string[]) => {
			names = next
			flushSync()
		},
		setActive: (next: boolean) => {
			active = next
			flushSync()
		},
	}
}
