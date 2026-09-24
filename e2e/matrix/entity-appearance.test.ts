import type { EntityDraft } from '../../src/lib/__tests__/__fixtures__/entityDrafts'

import { ENTITY_TYPES } from '../../src/lib/__tests__/__fixtures__/entityMatrix'
import { waitForCanvasToChange } from '../helpers/screenshot'
import { matrixDraft } from './drafts'
import { readEntityState, readSceneNames } from './entityState'
import { entityOneof, expect, test } from './fixture'

const RENDER_TIMEOUT_MS = 30_000

/**
 * A frame draws only when it carries the axes helper, and a shapeless drawing
 * never draws at all. Both are legitimate, so their appearance case turns the
 * helper on and asserts that instead.
 */
const NEEDS_AXES_HELPER = new Set(['frame', 'bare-drawing'])

/**
 * Types that reach the ECS correctly but never reach the canvas.
 *
 * A point cloud mounts a `Points` object holding every vertex and a colour
 * attribute, visible and at the origin, and all of its trait cells read the
 * state they should. Nothing draws. Its material size resolves to 0.01 world
 * units against a cloud spanning about one, because point cloud positions
 * travel raw where every other geometry here is given in millimetres and
 * converted, and a synthetic cloud rescaled to match did not render either.
 *
 * Marked rather than given an axes helper on purpose. The helper would turn
 * this green while proving something about `AxesHelpers` instead of about
 * point clouds, which is worse than a visible gap.
 */
const KNOWN_INVISIBLE = new Set(['pcd'])

const appearanceDraft = (typeName: string, draft: EntityDraft): EntityDraft =>
	NEEDS_AXES_HELPER.has(typeName)
		? { ...draft, metadata: { ...draft.metadata, showAxesHelper: true } }
		: draft

test.beforeEach(async ({ scene }) => {
	await scene.reset()
})

/**
 * Every type reaches the screen.
 *
 * The trait matrix stops at the ECS, which is where the wire ends. A renderer
 * that stopped claiming a trait would leave every one of those cells green and
 * draw nothing, so each type also gets one cell that watches the canvas.
 *
 * Compared against an empty scene rather than a committed baseline. The
 * question is whether the type renders at all, and a stored image would answer
 * it at the cost of a per-platform file that needs refreshing whenever the
 * default camera or the environment map moves.
 */
for (const type of ENTITY_TYPES) {
	const scenario = KNOWN_INVISIBLE.has(type.name) ? test.fixme : test

	scenario(`${type.name} renders`, async ({ scene }) => {
		await scene.add(appearanceDraft(type.name, matrixDraft(type)))

		await expect
			.poll(() => readEntityState(scene.page, type.name), { timeout: RENDER_TIMEOUT_MS })
			.toMatchObject({ present: true })

		const drawn = await waitForCanvasToChange(scene.page, scene.blankFrame, RENDER_TIMEOUT_MS)
		expect(drawn, `${type.name} reached the ECS but never reached the canvas`).not.toBeNull()
	})
}

test('adds every type in one batch', async ({ scene }) => {
	// The shared drafts all carry uuid 1, which is fine when a cell holds one
	// entity and collapses the whole batch into a single upsert here.
	const drafts = ENTITY_TYPES.map((type, index) => ({
		...appearanceDraft(type.name, matrixDraft(type)),
		name: `batch-${type.name}`,
		uuid: index + 1,
	}))

	const { uuids } = await scene.client.addEntities({
		entities: drafts.map((draft) => ({ entity: entityOneof(draft) })),
	})

	// One uuid per entity, in request order, is the whole contract AddEntities
	// adds over calling AddEntity in a loop.
	expect(uuids).toHaveLength(drafts.length)
	expect(new Set(uuids.map((uuid) => uuid.join(',')))).toHaveProperty('size', drafts.length)

	await expect
		.poll(() => readSceneNames(scene.page), { timeout: RENDER_TIMEOUT_MS })
		.toEqual(expect.arrayContaining(drafts.map((draft) => draft.name)))

	const drawn = await waitForCanvasToChange(scene.page, scene.blankFrame, RENDER_TIMEOUT_MS)
	expect(drawn, 'the batch reached the ECS but never reached the canvas').not.toBeNull()
})
