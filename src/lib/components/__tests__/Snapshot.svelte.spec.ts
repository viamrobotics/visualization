import { render } from '@testing-library/svelte'
import { createWorld, type World } from 'koota'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('$lib/hooks/useSettings.svelte', () => ({
	useSettings: vi.fn(() => ({ current: {} })),
}))
vi.mock('$lib/hooks/useControls.svelte', () => ({
	useCameraControls: vi.fn(() => ({ setPose: vi.fn(), setZoom: vi.fn() })),
}))

import { Transform, Vector3 } from '$lib/buf/common/v1/common_pb'
import { Drawing, Line, Shape } from '$lib/buf/draw/v1/drawing_pb'
import { Metadata, Relationship } from '$lib/buf/draw/v1/metadata_pb'
import { SceneCamera, SceneMetadata } from '$lib/buf/draw/v1/scene_pb'
import { Snapshot as SnapshotProto } from '$lib/buf/draw/v1/snapshot_pb'
import { uuidStringToBytes } from '$lib/draw'
import { relations, traits } from '$lib/ecs'
import { WORLD_CONTEXT_KEY } from '$lib/ecs/useWorld'
import { useCameraControls } from '$lib/hooks/useControls.svelte'

import SnapshotWithRelationships from './__fixtures__/SnapshotWithRelationships.svelte'

const SCENE_ONE = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
const SCENE_TWO = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'
const ENTITY_UUID = '11111111-1111-1111-1111-111111111111'
const LINK_SOURCE_UUID = '22222222-2222-2222-2222-222222222222'

const boxTransform = () =>
	new Transform({ referenceFrame: 'box', uuid: uuidStringToBytes(ENTITY_UUID) })

const snapshotOfOneTransform = (sceneUuid: string) =>
	new SnapshotProto({ uuid: uuidStringToBytes(sceneUuid), transforms: [boxTransform()] })

const lineHoverLinkedToBox = () =>
	new Drawing({
		referenceFrame: 'line',
		uuid: uuidStringToBytes(LINK_SOURCE_UUID),
		physicalObject: new Shape({
			geometryType: { case: 'line', value: new Line({ positions: new Uint8Array(24) }) },
		}),
		metadata: new Metadata({
			relationships: [
				new Relationship({ targetUuid: uuidStringToBytes(ENTITY_UUID), type: 'HoverLink' }),
			],
		}),
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
		render(SnapshotWithRelationships, {
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

	it('links an entity to the target its relationship names', () => {
		mountSnapshot(
			new SnapshotProto({
				uuid: uuidStringToBytes(SCENE_ONE),
				transforms: [boxTransform()],
				drawings: [lineHoverLinkedToBox()],
			})
		)
		const source = entityWithUuid(world, LINK_SOURCE_UUID)
		const target = entityWithUuid(world, ENTITY_UUID)

		expect(target && source?.get(relations.SubEntityLink(target))).toEqual({
			type: 'HoverLink',
			indexMapping: 'index',
		})
	})

	it('points the camera at the scene camera pose, converted from millimetres to metres', () => {
		mountSnapshot(
			new SnapshotProto({
				uuid: uuidStringToBytes(SCENE_ONE),
				sceneMetadata: new SceneMetadata({
					sceneCamera: new SceneCamera({
						position: new Vector3({ x: 1000, y: 2000, z: 3000 }),
						lookAt: new Vector3({ x: 0, y: 0, z: 500 }),
					}),
				}),
			})
		)
		const cameraControls = vi.mocked(useCameraControls).mock.results[0]?.value

		expect(cameraControls?.setPose).toHaveBeenCalledWith({
			position: [1, 2, 3],
			lookAt: [0, 0, 0.5],
		})
	})
})
