import type { World } from 'koota'

import { render } from '@testing-library/svelte'
import { describe, expect, it } from 'vitest'

import { traits } from '#lib/ecs/index.js'

import WorldHost from './__fixtures__/WorldHost.svelte'

const KOOTA_WORLD_LIMIT = 16

const mountWorld = () => {
	let mounted: World | undefined
	const { unmount } = render(WorldHost, { onworld: (world: World) => (mounted = world) })
	if (!mounted) throw new Error('the host never provided a world')
	return { world: mounted, unmount }
}

const settleTeardown = () => new Promise<void>((resolve) => queueMicrotask(resolve))

describe('provideWorld', () => {
	it('frees its world on unmount, so mounting past the Koota limit one at a time still works', async () => {
		const mountErrors: unknown[] = []

		for (let mount = 0; mount <= KOOTA_WORLD_LIMIT; mount += 1) {
			try {
				mountWorld().unmount()
			} catch (error) {
				mountErrors.push(error)
			}
			await settleTeardown()
		}

		expect(mountErrors).toEqual([])
	})

	it('keeps the world usable while the unmounting scene tears its children down', () => {
		const { world, unmount } = mountWorld()
		const entity = world.spawn(traits.Name('still-here'))

		unmount()

		expect(world.has(entity), 'the world was destroyed before teardown finished').toBe(true)
	})
})
