import { createWorld, type World } from 'koota'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const context = vi.hoisted(() => ({ world: undefined as World | undefined }))

vi.mock('$lib/ecs/useWorld', () => ({
	useWorld: () => context.world,
	provideWorld: vi.fn(),
	WORLD_CONTEXT_KEY: Symbol('koota-context'),
}))

import { uuidStringToBytes } from '$lib/draw'
import { relations, traits } from '$lib/ecs'

import { createServerRelationships } from '../serverRelationships'

const SOURCE_UUID = '11111111-1111-1111-1111-111111111111'
const TARGET_UUID = '22222222-2222-2222-2222-222222222222'

const hoverLinkTo = (targetUuid: string) => ({
	targetUuid: uuidStringToBytes(targetUuid),
	type: 'HoverLink',
	indexMapping: 'index',
})

describe('createServerRelationships', () => {
	let world: World

	beforeEach(() => {
		world = createWorld()
		context.world = world
	})

	afterEach(() => {
		world.destroy()
	})

	it('links the source to a target that already exists', () => {
		const source = world.spawn(traits.UUID(SOURCE_UUID))
		const target = world.spawn(traits.UUID(TARGET_UUID))
		const serverRelationships = createServerRelationships()

		serverRelationships.apply(source, SOURCE_UUID, [hoverLinkTo(TARGET_UUID)])

		expect(source.get(relations.SubEntityLink(target))).toEqual({
			type: 'HoverLink',
			indexMapping: 'index',
		})
	})

	it('removes a link the server authored once an update omits it', () => {
		const source = world.spawn(traits.UUID(SOURCE_UUID))
		const target = world.spawn(traits.UUID(TARGET_UUID))
		const serverRelationships = createServerRelationships()
		serverRelationships.apply(source, SOURCE_UUID, [hoverLinkTo(TARGET_UUID)])

		serverRelationships.apply(source, SOURCE_UUID, [])

		expect(source.has(relations.SubEntityLink(target))).toBe(false)
	})
})
