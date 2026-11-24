import type { ComponentProps } from 'svelte'

import { cleanup, render } from '@testing-library/svelte'
import { createWorld, type World } from 'koota'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { traits } from '#lib/ecs/index.js'
import { WORLD_CONTEXT_KEY } from '#lib/ecs/useWorld.js'

import FolderHost from './__fixtures__/FolderHost.svelte'

let world: World

beforeEach(() => {
	world = createWorld()
})

afterEach(() => {
	cleanup()
	world.destroy()
})

const mountHost = (props: ComponentProps<typeof FolderHost>) =>
	render(FolderHost, { props, context: new Map([[WORLD_CONTEXT_KEY, world]]) })

describe('useFolder', () => {
	it('shares one entity between producers naming the same id, with their sources unioned', () => {
		mountHost({ sources: [traits.DrawAPI] })
		mountHost({ sources: [traits.SnapshotAPI] })

		const folders = world.query(traits.Folder)

		expect(folders).toHaveLength(1)
		expect(folders[0]?.get(traits.Folder)?.sources).toEqual([traits.DrawAPI, traits.SnapshotAPI])
	})

	it('keeps the folder, minus its sources, while another producer is mounted', () => {
		const first = mountHost({ sources: [traits.DrawAPI] })
		mountHost({ sources: [traits.SnapshotAPI] })

		first.unmount()

		expect(world.query(traits.Folder)[0]?.get(traits.Folder)?.sources).toEqual([traits.SnapshotAPI])
	})

	it('destroys the folder when its last producer unmounts', () => {
		const first = mountHost({ sources: [traits.DrawAPI] })
		const second = mountHost({ sources: [traits.SnapshotAPI] })

		first.unmount()
		second.unmount()

		expect(world.query(traits.Folder)).toHaveLength(0)
	})

	it('follows a changed placeholder', async () => {
		const host = mountHost({ sources: [traits.DrawAPI] })

		await host.rerender({ sources: [traits.DrawAPI], placeholder: 'Nothing drawn' })

		expect(world.query(traits.Folder)[0]?.get(traits.Folder)?.placeholder).toBe('Nothing drawn')
	})
})
