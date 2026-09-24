import { Code, ConnectError } from '@connectrpc/connect'

import type { EntityDraft } from '../../src/lib/__tests__/__fixtures__/entityDrafts'

import { packFloats } from '../../src/lib/__tests__/__fixtures__/entityDrafts'
import { Points } from '../../src/lib/buf/draw/v1/drawing_pb'
import { entityOneof, expect, pollState, test } from './fixture'

const BOX = 'mask-box'
const POINTS = 'mask-points'
const PARENT = 'mask-parent'

const RED = new Uint8Array([255, 0, 0])
const BLUE = new Uint8Array([0, 0, 255])
const RED_RGB = { r: 1, g: 0, b: 0 }

const TRIANGLE = packFloats(0, 0, 0, 100, 0, 0, 100, 100, 0)

const boxDraft = (): EntityDraft => ({
	name: BOX,
	kind: 'transform',
	uuid: 1,
	pose: { x: 0, y: 0, z: 0 },
	geometry: { case: 'box', value: { dimsMm: { x: 100, y: 100, z: 100 } } },
	metadata: { colors: RED, opacities: new Uint8Array([255]) },
})

const pointsDraft = (): EntityDraft => ({
	name: POINTS,
	kind: 'drawing',
	uuid: 1,
	pose: { x: 0, y: 0, z: 0 },
	shape: { case: 'points', value: new Points({ positions: TRIANGLE }) },
	metadata: { colors: RED, opacities: new Uint8Array([255]) },
})

/**
 * A mask is only meaningful if the fields it leaves out are also different in
 * the payload. Every case below sends a fully changed entity and asserts that
 * exactly the masked part landed.
 */
test.describe('field mask', () => {
	test.beforeEach(async ({ scene }) => {
		await scene.reset()
	})

	test('moves a transform without resending its color', async ({ scene }) => {
		const uuid = await scene.add(boxDraft())
		await pollState(scene, BOX, { present: true, color: RED_RGB })

		await scene.update(
			uuid,
			{ ...boxDraft(), pose: { x: 500, y: 0, z: 0 }, metadata: { colors: BLUE } },
			['pose_in_observer_frame.pose']
		)

		await pollState(scene, BOX, { worldPosition: [0.5, 0, 0], color: RED_RGB })
	})

	test('recolors a transform without resending its pose', async ({ scene }) => {
		const uuid = await scene.add({ ...boxDraft(), pose: { x: 500, y: 0, z: 0 } })
		await pollState(scene, BOX, { worldPosition: [0.5, 0, 0] })

		await scene.update(
			uuid,
			{ ...boxDraft(), pose: { x: 0, y: 0, z: 0 }, metadata: { colors: BLUE } },
			['metadata']
		)

		await pollState(scene, BOX, { worldPosition: [0.5, 0, 0], color: { r: 0, g: 0, b: 1 } })
	})

	test('reparents a transform without moving it', async ({ scene }) => {
		await scene.add({
			name: PARENT,
			kind: 'transform',
			uuid: 2,
			pose: { x: 1000, y: 0, z: 0 },
			metadata: {},
		})
		const uuid = await scene.add({ ...boxDraft(), pose: { x: 200, y: 0, z: 0 } })
		await pollState(scene, BOX, { parent: undefined, worldPosition: [0.2, 0, 0] })

		await scene.update(uuid, { ...boxDraft(), pose: { x: 0, y: 0, z: 0 }, parent: PARENT }, [
			'pose_in_observer_frame.reference_frame',
		])

		// The local pose the mask left alone still composes against the new parent.
		await pollState(scene, BOX, { parent: PARENT, orphan: undefined, worldPosition: [1.2, 0, 0] })
	})

	test('recolors a drawing without resending its opacity', async ({ scene }) => {
		const uuid = await scene.add(pointsDraft())
		await pollState(scene, POINTS, { present: true, color: RED_RGB, opacity: 1 })

		await scene.update(
			uuid,
			{ ...pointsDraft(), metadata: { colors: BLUE, opacities: new Uint8Array([64]) } },
			['metadata.colors']
		)

		await pollState(scene, POINTS, { color: { r: 0, g: 0, b: 1 }, opacity: 1 })
	})

	// A transform carries metadata as an untyped google.protobuf.Struct, so the
	// service refuses to merge into it. Two guards reject the attempt, and which
	// one answers depends on the path: the descriptor walk catches anything that
	// is not a real field of Struct, and only `metadata.fields` gets far enough
	// to reach the guard written for this case.
	const rejectedPaths = [
		['metadata.colors', 'invalid path'],
		['metadata.fields', 'can only be replaced wholesale'],
	] as const

	for (const [path, message] of rejectedPaths) {
		test(`rejects the mask path ${path}`, async ({ scene }) => {
			const uuid = await scene.add(boxDraft())
			await pollState(scene, BOX, { present: true, color: RED_RGB })

			const rejected = await scene.client
				.updateEntity({
					uuid,
					entity: entityOneof({ ...boxDraft(), metadata: { colors: BLUE } }),
					updatedFields: { paths: [path] },
				})
				.then(
					() => undefined,
					(error: unknown) => error
				)

			expect(rejected).toBeInstanceOf(ConnectError)
			expect((rejected as ConnectError).code).toBe(Code.InvalidArgument)
			expect((rejected as ConnectError).message).toContain(message)

			// A rejected update must not have been partly applied.
			await pollState(scene, BOX, { color: RED_RGB })
		})
	}
})
