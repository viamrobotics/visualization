import { render } from '@testing-library/svelte'
import { createWorld, type World } from 'koota'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('$lib/hooks/useSettings.svelte', () => ({
	useSettings: vi.fn(() => ({ current: {} })),
}))
vi.mock('$lib/hooks/useControls.svelte', () => ({
	useCameraControls: vi.fn(() => ({ setPose: vi.fn(), setZoom: vi.fn() })),
}))
vi.mock('$lib/hooks/useRelationships.svelte', () => ({
	useRelationships: vi.fn(() => ({ apply: vi.fn(), flush: vi.fn() })),
}))

import { Transform } from '$lib/buf/common/v1/common_pb'
import { Snapshot as SnapshotProto } from '$lib/buf/draw/v1/snapshot_pb'
import { uuidStringToBytes } from '$lib/draw'
import { traits } from '$lib/ecs'
import { WORLD_CONTEXT_KEY } from '$lib/ecs/useWorld'

import Snapshot from '../Snapshot.svelte'

const SCENE_ONE = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
const SCENE_TWO = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'
const ENTITY_UUID = '11111111-1111-1111-1111-111111111111'

const snapshotOfOneTransform = (sceneUuid: string) =>
	new SnapshotProto({
		uuid: uuidStringToBytes(sceneUuid),
		transforms: [new Transform({ referenceFrame: 'box', uuid: uuidStringToBytes(ENTITY_UUID) })],
	})

const entityWithUuid = (world: World, uuid: string) =>
	world.query(traits.UUID).find((entity) => entity.get(traits.UUID) === uuid)

describe('Snapshot', () => {
	let world: World

	beforeEach(() => {
		world = createWorld()
	})

	afterEach(() => {
		world.destroy()
	})

	const mountSnapshot = (snapshot: SnapshotProto) =>
		render(Snapshot, {
			props: { snapshot },
			context: new Map([[WORLD_CONTEXT_KEY, world]]),
		})

	it('updates an entity in place when the next load carries the same snapshot uuid', async () => {
		const { rerender } = mountSnapshot(snapshotOfOneTransform(SCENE_ONE))
		const first = entityWithUuid(world, ENTITY_UUID)

		await rerender({ snapshot: snapshotOfOneTransform(SCENE_ONE) })

		expect(entityWithUuid(world, ENTITY_UUID)).toBe(first)
	})

	it('replaces every entity when the snapshot uuid changes, even where entity UUIDs repeat', async () => {
		const { rerender } = mountSnapshot(snapshotOfOneTransform(SCENE_ONE))
		const first = entityWithUuid(world, ENTITY_UUID)

		await rerender({ snapshot: snapshotOfOneTransform(SCENE_TWO) })

		expect(first && world.has(first)).toBe(false)
		expect(world.query(traits.UUID).map((entity) => entity.get(traits.UUID))).toEqual([ENTITY_UUID])
	})
})
