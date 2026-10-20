import type { BrowserContext, Page } from '@playwright/test'

import { expect } from '@playwright/test'

import type { EntityDraft } from '../../src/lib/__tests__/__fixtures__/entityDrafts'
import type { DrawClient } from '../helpers/drawClient'
import type { ExpectedEntityState } from './entityState'

import { toDrawing, toTransform } from '../../src/lib/__tests__/__fixtures__/entityDrafts'
import { test as drawingTest } from '../fixtures/drawing'
import { createDrawClient, resetScene } from '../helpers/drawClient'
import { waitForCanvasToSettle } from '../helpers/screenshot'
import { readEntityState } from './entityState'

/** The `AddEntityRequest.entity` oneof, picked by which entry point the draft renders through. */
export const entityOneof = (draft: EntityDraft) =>
	draft.kind === 'transform'
		? ({ case: 'transform', value: toTransform(draft) } as const)
		: ({ case: 'drawing', value: toDrawing(draft) } as const)

/**
 * Long enough for the service round trip plus the browser's rAF-bounded
 * coalescing flush, short enough that a dropped field fails one cell rather
 * than the whole worker.
 */
export const CONVERGE_TIMEOUT_MS = 15_000

/** Polls one entity's state until it matches, within the convergence budget. */
export const pollState = (scene: MatrixScene, name: string, expected: ExpectedEntityState) =>
	expect
		.poll(() => readEntityState(scene.page, name), { timeout: CONVERGE_TIMEOUT_MS })
		.toMatchObject(expected)

export interface MatrixScene {
	page: Page
	client: DrawClient
	/** The settled canvas of an empty scene, for the visibility cells to compare against. */
	blankFrame: Buffer
	/** Adds `draft` and returns the uuid the service assigned it. */
	add: (draft: EntityDraft) => Promise<Uint8Array<ArrayBuffer>>
	update: (uuid: Uint8Array<ArrayBuffer>, draft: EntityDraft, maskPaths?: string[]) => Promise<void>
	reset: () => Promise<void>
}

interface MatrixWorkerFixtures {
	scene: MatrixScene
}

/**
 * One page per worker rather than one per test.
 *
 * A matrix cell is two RPCs and a poll, so a fresh page per cell would spend
 * most of the suite loading the app. Cells stay isolated because each one
 * clears the scene before it runs and asserts on an entity it named itself.
 */
export const test = drawingTest.extend<object, MatrixWorkerFixtures>({
	scene: [
		async ({ browser, drawServer }, use, workerInfo) => {
			// Playwright instruments browser.newContext, so the project's `trace`
			// setting applies here and each test still gets its own recording. Do
			// not call tracing.start on this context: it is already running.
			const context: BrowserContext = await browser.newContext({
				baseURL: workerInfo.project.use.baseURL,
			})

			const page = await context.newPage()
			if (process.env.E2E_DEBUG) {
				page.on('console', (message) => {
					console.log(`[${message.type()}] ${message.text()}`)
				})
			}

			await page.goto(`?drawPort=${drawServer.port}`)
			await page.waitForLoadState('load')
			await page
				.getByRole('heading', { name: 'World', exact: true })
				.waitFor({ state: 'visible', timeout: 30_000 })

			const client = createDrawClient(drawServer.port)
			await client.removeAll({})
			const blankFrame = await waitForCanvasToSettle(page)

			await use({
				page,
				client,
				blankFrame,
				add: async (draft) => {
					const { uuid } = await client.addEntity({ entity: entityOneof(draft) })
					return Uint8Array.from(uuid)
				},
				update: async (uuid, draft, maskPaths) => {
					await client.updateEntity({
						uuid,
						entity: entityOneof(draft),
						updatedFields: maskPaths ? { paths: maskPaths } : undefined,
					})
				},
				reset: () => resetScene(client, page),
			})

			await context.close()
		},
		{ scope: 'worker' },
	],
})

export { expect } from '@playwright/test'
