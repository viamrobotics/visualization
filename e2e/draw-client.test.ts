import { packFloats, toDrawing, toTransform } from '../src/lib/__tests__/__fixtures__/entityDrafts'
import { Points } from '../src/lib/buf/draw/v1/drawing_pb'
import { type DrawScene, type DrawSceneAsync, expect, type Page, test } from './fixtures/drawing'
import { readCameraPose } from './helpers/cameraPose'
import { screenshotCanvas, waitForCanvasToSettle } from './helpers/screenshot'

// The draw server outlives each page and replays every entity to a reconnecting
// client. A test that dies before its reset would otherwise strand entities into
// the snapshots of later tests sharing this worker's server.
test.beforeEach(async ({ drawClient }) => {
	await drawClient.removeAll({})
})

interface ChunkedRun {
	page: Page
	drawSceneAsync: DrawSceneAsync
	snapshotAndReset: (testPrefix: string) => Promise<void>
}

const runChunkedTest = async (
	{ page, drawSceneAsync, snapshotAndReset }: ChunkedRun,
	testPrefix: string,
	sceneName: string
) => {
	const pull = drawSceneAsync(sceneName)

	await expect(page.getByRole('progressbar', { name: /Loading/ })).toBeVisible({
		timeout: 120_000,
	})

	await pull

	await expect(page.getByRole('progressbar')).toHaveCount(0, { timeout: 120_000 })

	await snapshotAndReset(testPrefix)
}

test('draw service events lifecycle', async ({ page, drawScene, resetScene }) => {
	drawScene('lifecycle/add')

	await expect(page.getByText('lifecycle-box')).toBeVisible({ timeout: 10000 })
	await expect(page.getByText('lifecycle-line')).toBeVisible({ timeout: 10000 })
	await screenshotCanvas(page, 'DRAW_SERVICE_EVENTS_ADDED')

	drawScene('lifecycle/update')

	await expect(page.getByText('lifecycle-box')).toBeVisible({ timeout: 10000 })
	await expect(page.getByText('lifecycle-line')).toBeVisible({ timeout: 10000 })
	await screenshotCanvas(page, 'DRAW_SERVICE_EVENTS_UPDATED')

	drawScene('lifecycle/remove-all')

	await expect(page.getByText('No objects displayed', { exact: true })).toBeVisible({
		timeout: 15000,
	})
	await screenshotCanvas(page, 'DRAW_SERVICE_EVENTS_REMOVED')

	await resetScene()
})

test('draw frame system', async ({ page, drawScene, snapshotAndReset }) => {
	const testPrefix = 'DRAW_FRAME_SYSTEM'

	drawScene('frame-system/draw')

	await expect(page.getByText('No objects displayed', { exact: true })).not.toBeVisible()

	await snapshotAndReset(testPrefix)
})

test('draw hierarchy', async ({ page, drawScene, resetScene, takeScreenshot }) => {
	const testPrefix = 'DRAW_HIERARCHY'

	drawScene('hierarchy/draw')

	await expect(page.getByText('zulu', { exact: true })).toBeVisible()
	await expect(page.getByText('bravo', { exact: true })).toBeVisible()

	await page
		.locator('[data-part="branch-control"]')
		.filter({ hasText: 'zulu' })
		.locator('[data-part="branch-trigger"]')
		.click()
	await expect(page.getByText('tango', { exact: true })).toBeVisible()
	await expect(page.getByText('delta', { exact: true })).toBeVisible()

	await takeScreenshot(`${testPrefix}_ZULU_EXPANDED`)

	await page
		.locator('[data-part="branch-control"]')
		.filter({ hasText: 'tango' })
		.locator('[data-part="branch-trigger"]')
		.click()
	await expect(page.getByText('sierra', { exact: true })).toBeVisible()
	await expect(page.getByText('foxtrot', { exact: true })).toBeVisible()

	await takeScreenshot(`${testPrefix}_TANGO_EXPANDED`)

	await resetScene()
})

test('draw frames', async ({ page, drawScene, snapshotAndReset }) => {
	const testPrefix = 'DRAW_FRAMES'

	drawScene('frames/draw')

	await expect(page.getByText('DrawFrames Axes')).toBeVisible()
	await expect(page.getByText('DrawFrames Sphere')).toBeVisible()
	await expect(page.getByText('DrawFrames Capsule:Capsule')).toBeVisible()

	// The colored group. Asserted here because the baseline has always held all
	// six frames, and until now only the first three were named.
	await expect(page.getByText('DrawFrames Red:Box')).toBeVisible()
	await expect(page.getByText('DrawFrames Blue:Sphere')).toBeVisible()
	await expect(page.getByText('DrawFrames Default')).toBeVisible()

	await snapshotAndReset(testPrefix)
})

test('draw geometries', async ({ page, drawScene, snapshotAndReset }) => {
	const testPrefix = 'DRAW_GEOMETRIES'

	drawScene('geometries/draw')

	await expect(page.getByText('DrawGeometries Box')).toBeVisible()
	await expect(page.getByText('DrawGeometries Sphere')).toBeVisible()
	await expect(page.getByText('DrawGeometries Capsule')).toBeVisible()
	await expect(page.getByText('DrawGeometries Mesh')).toBeVisible()
	await expect(page.getByText('DrawGeometries PointCloud')).toBeVisible()

	await snapshotAndReset(testPrefix)
})

test('draw point cloud', async ({ page, drawScene, snapshotAndReset }) => {
	const testPrefix = 'DRAW_POINT_CLOUD'

	drawScene('point-cloud/files')

	await expect(page.getByText('octagon')).toBeVisible()
	await expect(page.getByText('Zaghetto')).toBeVisible()
	await expect(page.getByText('simple')).toBeVisible()
	await expect(page.getByText('boat')).toBeVisible()

	await snapshotAndReset(testPrefix)
})

test('draw point cloud updating', async ({ page, drawScene, snapshotAndReset }) => {
	const testPrefix = 'DRAW_POINT_CLOUD_UPDATING'

	drawScene('point-cloud/updating')

	await expect(page.getByText('DrawPointCloud updating')).toBeVisible()

	await snapshotAndReset(testPrefix)
})

test('draw point cloud in chunks', async ({ page, drawSceneAsync, snapshotAndReset }) => {
	// 2.5M points pulled a chunk at a time, with the progress bar asserted mid-flight.
	test.slow()

	await runChunkedTest(
		{ page, drawSceneAsync, snapshotAndReset },
		'DRAW_POINT_CLOUD_IN_CHUNKS',
		'point-cloud/chunked'
	)
})

test('chunked point cloud survives a reconnect', async ({ page, drawScene, snapshotAndReset }) => {
	const testPrefix = 'CHUNKED_POINT_CLOUD_RECONNECT'

	// The small chunked cloud on purpose: this test loads one twice, and the
	// multi-million point fixtures are too slow to do that inside the timeout.
	// Several chunks with per-point colors is all the coverage needs.
	drawScene('point-cloud/chunked-small')

	await expect(page.getByText('chunked_point_cloud_small')).toBeVisible({ timeout: 30_000 })
	await expect(page.getByRole('progressbar')).toHaveCount(0, { timeout: 60_000 })

	// Reload rather than reconnect the socket: either way the client resubscribes and the service
	// replays the scene, and a reload is the one a user actually performs.
	await page.reload()
	await expect(page.getByText('World', { exact: true })).toBeVisible({ timeout: 30_000 })
	await expect(page.getByText('chunked_point_cloud_small')).toBeVisible({ timeout: 30_000 })

	// A replayed chunked entity has to finish pulling. A missing chunks descriptor
	// means the client never starts, and a stalled pull means it never ends. Either
	// way the scene holds only the first chunk.
	const progress = page.getByRole('progressbar', { name: /Loading/ })
	const stalledAt = async () =>
		`pull did not finish, last progress: ${await progress.getAttribute('aria-label')}`
	await expect(progress)
		.toHaveCount(0, { timeout: 60_000 })
		.catch(async (error: unknown) => {
			throw new Error(await stalledAt(), { cause: error })
		})

	// The snapshot catches a partial pull that still cleared the progress bar: a cloud missing
	// most of its chunks looks obviously wrong.
	await waitForCanvasToSettle(page, { timeoutMs: 30_000 })
	await snapshotAndReset(testPrefix)
})

test('draw world state', async ({ page, drawScene, snapshotAndReset }) => {
	const testPrefix = 'DRAW_WORLD_STATE'

	drawScene('world-state/draw')

	await expect(page.getByText('box0')).toBeVisible()
	await expect(page.getByText('box1')).toBeVisible()
	await expect(page.getByText('box2')).toBeVisible()

	await snapshotAndReset(testPrefix)
})

/**
 * Color and opacity for a point cloud do not travel as `Color`/`Colors` traits
 * the way they do for every other type. They are folded into the parsed buffer
 * geometry by `parsePointCloud`, so the matrix cannot reach them and the canvas
 * is the only assertion available.
 */
test('draw point cloud colors', async ({ page, drawScene, snapshotAndReset }) => {
	const variants = [
		['DRAW_POINT_CLOUDS_WITH_SINGLE_COLOR', 'point-cloud/single-color', 'octagon_single_color'],
		['DRAW_POINT_CLOUD_WITH_OPACITY', 'point-cloud/opacity', 'octagon_with_opacity'],
		['DRAW_POINT_CLOUDS_WITH_COLOR_PALETTE', 'point-cloud/palette', 'Zaghetto_palette'],
		['DRAW_POINT_CLOUDS_WITH_PER_POINT_COLOR', 'point-cloud/per-point-colors', 'simple_per_point'],
	] as const

	for (const [testPrefix, sceneName, label] of variants) {
		drawScene(sceneName)

		await expect(page.getByText(label)).toBeVisible()

		await snapshotAndReset(testPrefix)
	}
})

test('draw point clouds with downscaling', async ({ page, drawScene, snapshotAndReset }) => {
	const testPrefix = 'DRAW_POINT_CLOUDS_WITH_DOWNSCALING'

	drawScene('point-cloud/downscaled')

	await expect(page.getByText('boat_downscaled')).toBeVisible()

	await snapshotAndReset(testPrefix)
})

/**
 * The only test that drives `SetScene` and its `StreamSceneChanges` broadcast.
 * Asserted numerically rather than as a canvas baseline: a camera that lands a
 * few degrees off still produces a plausible-looking image.
 */
test('set camera pose', async ({ page, drawScene, resetScene }) => {
	drawScene('camera/top-down')

	await expect(page.getByText('reference_box')).toBeVisible()

	// The service sends millimetres, the client renders metres.
	await expect
		.poll(() => readCameraPose(page), { timeout: 15_000 })
		.toEqual({ position: [0, 0, 5], target: [0, 0, 0] })

	drawScene('camera/reset')

	await expect
		.poll(() => readCameraPose(page), { timeout: 15_000 })
		.toEqual({ position: [3, 3, 3], target: [0, 0, 0] })

	await resetScene()
})

const CLEAR_BOX = 'clear-box'
const CLEAR_POINTS = 'clear-points'

const clearBox = () =>
	toTransform({
		name: CLEAR_BOX,
		kind: 'transform',
		uuid: 1,
		pose: { x: 0, y: 0, z: 0 },
		geometry: { case: 'box', value: { dimsMm: { x: 100, y: 100, z: 100 } } },
		metadata: {},
	})

const clearPoints = () =>
	toDrawing({
		name: CLEAR_POINTS,
		kind: 'drawing',
		uuid: 2,
		pose: { x: 0, y: 0, z: 0 },
		shape: {
			case: 'points',
			value: new Points({ positions: packFloats(0, 0, 0, 100, 0, 0, 100, 100, 0) }),
		},
		metadata: {},
	})

/**
 * The three scoped clears in one scene, because what distinguishes them is
 * which half of a mixed scene survives. Each is checked by what is left in the
 * tree and by the count the RPC reports.
 */
test('scoped clears', async ({ page, drawClient, resetScene }) => {
	const box = page.getByText(CLEAR_BOX, { exact: true })
	const points = page.getByText(CLEAR_POINTS, { exact: true })

	const seed = async () => {
		await drawClient.addEntities({
			entities: [
				{ entity: { case: 'transform', value: clearBox() } },
				{ entity: { case: 'drawing', value: clearPoints() } },
			],
		})
		await expect(box).toBeVisible()
		await expect(points).toBeVisible()
	}

	await seed()
	expect(await drawClient.removeAllDrawings({})).toMatchObject({ count: 1 })
	await expect(points).toBeHidden()
	await expect(box).toBeVisible()

	await seed()
	expect(await drawClient.removeAllTransforms({})).toMatchObject({ count: 1 })
	await expect(box).toBeHidden()
	await expect(points).toBeVisible()

	await seed()
	expect(await drawClient.removeAll({})).toMatchObject({ transformCount: 1, drawingCount: 1 })
	await expect(page.getByText('No objects displayed', { exact: true })).toBeVisible()

	await resetScene()
})

test('replay', async ({ page, drawScene, resetScene }) => {
	const testPrefix = 'REPLAY'

	drawScene('replay/record')

	await expect(page.getByText('bouncing_ball')).toBeVisible()

	await screenshotCanvas(page, `${testPrefix}_RECORD`)

	await resetScene()

	drawScene('replay/playback')

	await expect(page.getByText('bouncing_ball')).toBeVisible()

	await screenshotCanvas(page, `${testPrefix}_PLAYBACK`)

	await resetScene()
})

interface RedrawRun {
	page: Page
	drawScene: DrawScene
	snapshotAndReset: (testPrefix: string) => Promise<void>
}

const runRedrawLoop = async (
	{ page, drawScene, snapshotAndReset }: RedrawRun,
	testPrefix: string,
	sceneName: string
) => {
	drawScene(sceneName)

	await expect(page.getByText('redraw-box-00', { exact: true })).toBeVisible({ timeout: 10000 })

	// The tree is virtualized, so counting rows proves nothing. The canvas is the
	// assertion: the boxes are a 6x4 grid in a fixed palette, so a lost change reads
	// as a hole and a misapplied one as a wrong-colored cell.
	await waitForCanvasToSettle(page)
	await snapshotAndReset(testPrefix)
}

/**
 * The reported failure: a producer clearing the scene and redrawing it every tick.
 *
 * Both tests below draw the identical grid and must produce the identical image. The first clears
 * before each redraw, the second does not, and the point is that the visualizer converges to the
 * same scene either way. Before this fix the clearing variant lost entities: a removal and the
 * re-add that followed it could land in the same animation frame, where the re-add was discarded.
 */
test('redraw loop clearing and redrawing', async ({ page, drawScene, snapshotAndReset }) => {
	await runRedrawLoop(
		{ page, drawScene, snapshotAndReset },
		'REDRAW_LOOP_WITH_CLEAR',
		'redraw-loop/with-clear'
	)
})

// The pattern we recommend instead: identities are deterministic, so redrawing upserts in place
// and the service never publishes a removal at all.
test('redraw loop without clearing', async ({ page, drawScene, snapshotAndReset }) => {
	await runRedrawLoop(
		{ page, drawScene, snapshotAndReset },
		'REDRAW_LOOP_NO_CLEAR',
		'redraw-loop/without-clear'
	)
})

test('relationships', async ({ page, drawScene, resetScene, takeScreenshot }) => {
	drawScene('relationships/setup')

	await expect(page.getByText('rel-source', { exact: true })).toBeVisible({ timeout: 10000 })
	await expect(page.getByText('rel-target', { exact: true })).toBeVisible({ timeout: 10000 })

	drawScene('relationships/create')

	await page.getByText('rel-source', { exact: true }).click()
	await expect(page.getByText('rel-target (HoverLink)')).toBeVisible({ timeout: 10000 })
	await takeScreenshot('RELATIONSHIPS_CREATED')

	drawScene('relationships/delete')

	await expect(page.getByText('rel-target (HoverLink)')).not.toBeVisible({ timeout: 10000 })
	await takeScreenshot('RELATIONSHIPS_DELETED')

	await resetScene()
})

/**
 * A known service gap, not a flake: StreamEntityChanges replays entities to a reconnecting
 * client but not relationships, so a HoverLink is lost on reload. Written out as a fixme so
 * the gap is visible in the report and turns green on its own once the service replays them.
 */
test.fixme('relationships survive a reload', async ({ page, drawScene, resetScene }) => {
	drawScene('relationships/setup')
	await expect(page.getByText('rel-source', { exact: true })).toBeVisible({ timeout: 10000 })

	drawScene('relationships/create')
	await page.getByText('rel-source', { exact: true }).click()
	await expect(page.getByText('rel-target (HoverLink)')).toBeVisible({ timeout: 10000 })

	await page.reload()
	await expect(page.getByText('World', { exact: true })).toBeVisible({ timeout: 30_000 })

	await page.getByText('rel-source', { exact: true }).click()
	await expect(page.getByText('rel-target (HoverLink)')).toBeVisible({ timeout: 10000 })

	await resetScene()
})
