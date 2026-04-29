import { Browser, expect, Page, test } from '@playwright/test'
import { exec, execSync } from 'node:child_process'
import { promisify } from 'node:util'

const execAsync = promisify(exec)

const createPage = async (browser: Browser): Promise<Page> => {
	const context = await browser.newContext()
	const page = await context.newPage()
	page.on('console', (message) => {
		console.log(`[${message.type()}] ${message.text()}`)
	})
	await page.goto('/')
	await expect(page.getByText('World', { exact: true })).toBeVisible({ timeout: 10000 })
	return page
}

const takeScreenshot = async (page: Page, testPrefix: string): Promise<string> => {
	try {
		await expect(page).toHaveScreenshot(`${testPrefix}.png`, {
			fullPage: true,
			threshold: 0.1,
		})
		return ''
	} catch (error) {
		console.warn(error)
		return `${testPrefix}.png`
	}
}

const cleanup = async (page: Page) => {
	execSync(
		'go test -run ^TestRemoveAll$/RemoveAllHelper github.com/viam-labs/motion-tools/client/api -count=1',
		{
			encoding: 'utf8',
		}
	)

	await expect(page.getByText('No objects displayed', { exact: true })).toBeVisible({
		timeout: 15000,
	})
}

const assertNoFailedScreenshots = (failedScreenshots: string[]) => {
	const failures = failedScreenshots.filter((screenshot) => screenshot !== '')
	if (failures.length > 0) {
		console.log(`Failed screenshots: ${failures.join(', ')}`)
		throw new Error(`Failed screenshots: ${failures.join(', ')}`)
	}
}

const assertTestSuccess = async (page: Page, testPrefix: string) => {
	const failedScreenshot = await takeScreenshot(page, testPrefix)
	await cleanup(page)
	assertNoFailedScreenshots([failedScreenshot])
}

const runChunkedTest = async (browser: Browser, testPrefix: string, goTestPath: string) => {
	const page = await createPage(browser)
	const failedScreenshots: string[] = []

	const goTest = execAsync(
		`go test -run ${goTestPath} github.com/viam-labs/motion-tools/client/api -count=1 -timeout=300s`
	)

	await expect(page.getByRole('progressbar', { name: /Loading/ })).toBeVisible({
		timeout: 120_000,
	})

	await goTest

	await expect(page.getByRole('progressbar')).toHaveCount(0, { timeout: 120_000 })

	failedScreenshots.push(await takeScreenshot(page, testPrefix))

	await cleanup(page)

	assertNoFailedScreenshots(failedScreenshots)
}

test('draw service events lifecycle', async ({ browser }) => {
	const page = await createPage(browser)
	const failedScreenshots: string[] = []

	execSync(
		'go test -run ^TestDrawServiceEvents$/AddTransformAndDrawing github.com/viam-labs/motion-tools/client/api -count=1',
		{ encoding: 'utf8' }
	)

	await expect(page.getByText('lifecycle-box')).toBeVisible({ timeout: 10000 })
	await expect(page.getByText('lifecycle-line')).toBeVisible({ timeout: 10000 })
	failedScreenshots.push(await takeScreenshot(page, 'DRAW_SERVICE_EVENTS_ADDED'))

	execSync(
		'go test -run ^TestDrawServiceEvents$/UpdateTransformAndDrawing github.com/viam-labs/motion-tools/client/api -count=1',
		{ encoding: 'utf8' }
	)

	await expect(page.getByText('lifecycle-box')).toBeVisible({ timeout: 10000 })
	await expect(page.getByText('lifecycle-line')).toBeVisible({ timeout: 10000 })
	failedScreenshots.push(await takeScreenshot(page, 'DRAW_SERVICE_EVENTS_UPDATED'))

	execSync(
		'go test -run ^TestDrawServiceEvents$/RemoveAll github.com/viam-labs/motion-tools/client/api -count=1',
		{ encoding: 'utf8' }
	)

	await expect(page.getByText('No objects displayed', { exact: true })).toBeVisible({
		timeout: 15000,
	})
	failedScreenshots.push(await takeScreenshot(page, 'DRAW_SERVICE_EVENTS_REMOVED'))

	await cleanup(page)

	assertNoFailedScreenshots(failedScreenshots)
})

test('invisible entity', async ({ browser }) => {
	const page = await createPage(browser)
	const failedScreenshots: string[] = []

	execSync(
		'go test -run ^TestInvisible$/DrawVisible github.com/viam-labs/motion-tools/client/api -count=1',
		{ encoding: 'utf8' }
	)

	await expect(page.getByText('invisible-box')).toBeVisible({ timeout: 10000 })
	failedScreenshots.push(await takeScreenshot(page, 'INVISIBLE_ENTITY_VISIBLE'))

	execSync(
		'go test -run ^TestInvisible$/DrawInvisible github.com/viam-labs/motion-tools/client/api -count=1',
		{ encoding: 'utf8' }
	)

	await expect(page.getByText('invisible-box')).toBeVisible({ timeout: 10000 })
	failedScreenshots.push(await takeScreenshot(page, 'INVISIBLE_ENTITY_INVISIBLE'))

	await cleanup(page)

	assertNoFailedScreenshots(failedScreenshots)
})

test('show axes helper', async ({ browser }) => {
	const page = await createPage(browser)
	const failedScreenshots: string[] = []

	execSync(
		'go test -run ^TestShowAxesHelper$/DrawWithAxesHelper github.com/viam-labs/motion-tools/client/api -count=1',
		{ encoding: 'utf8' }
	)

	await expect(page.getByText('show-axes-helper-box')).toBeVisible({ timeout: 10000 })
	failedScreenshots.push(await takeScreenshot(page, 'SHOW_AXES_HELPER_WITH'))

	execSync(
		'go test -run ^TestShowAxesHelper$/DrawWithoutAxesHelper github.com/viam-labs/motion-tools/client/api -count=1',
		{ encoding: 'utf8' }
	)

	await expect(page.getByText('show-axes-helper-box')).toBeVisible({ timeout: 10000 })
	failedScreenshots.push(await takeScreenshot(page, 'SHOW_AXES_HELPER_WITHOUT'))

	await cleanup(page)

	assertNoFailedScreenshots(failedScreenshots)
})

test('draw frame system', async ({ browser }) => {
	const testPrefix = 'DRAW_FRAME_SYSTEM'
	const page = await createPage(browser)

	execSync(
		'go test -run ^TestDrawFrameSystem$/DrawFrameSystem github.com/viam-labs/motion-tools/client/api -count=1',
		{
			encoding: 'utf8',
		}
	)

	await expect(page.getByText('No objects displayed', { exact: true })).not.toBeVisible()

	await assertTestSuccess(page, testPrefix)
})

test('draw hierarchy', async ({ browser }) => {
	const testPrefix = 'DRAW_HIERARCHY'
	const page = await createPage(browser)
	const failedScreenshots: string[] = []

	execSync(
		'go test -run ^TestDrawHierarchy$/DrawHierarchy github.com/viam-labs/motion-tools/client/api -count=1',
		{
			encoding: 'utf8',
		}
	)

	await expect(page.getByText('zulu', { exact: true })).toBeVisible()
	await expect(page.getByText('bravo', { exact: true })).toBeVisible()

	await page
		.locator('[data-part="branch-control"]')
		.filter({ hasText: 'zulu' })
		.locator('[data-part="branch-indicator"]')
		.click()
	await expect(page.getByText('tango', { exact: true })).toBeVisible()
	await expect(page.getByText('delta', { exact: true })).toBeVisible()

	failedScreenshots.push(await takeScreenshot(page, `${testPrefix}_ZULU_EXPANDED`))

	await page
		.locator('[data-part="branch-control"]')
		.filter({ hasText: 'tango' })
		.locator('[data-part="branch-indicator"]')
		.click()
	await expect(page.getByText('sierra', { exact: true })).toBeVisible()
	await expect(page.getByText('foxtrot', { exact: true })).toBeVisible()

	failedScreenshots.push(await takeScreenshot(page, `${testPrefix}_TANGO_EXPANDED`))

	await cleanup(page)

	assertNoFailedScreenshots(failedScreenshots)
})

test('draw frames', async ({ browser }) => {
	const testPrefix = 'DRAW_FRAMES'
	const page = await createPage(browser)

	execSync(
		'go test -run ^TestDrawFrames$/DrawFrames github.com/viam-labs/motion-tools/client/api -count=1',
		{
			encoding: 'utf8',
		}
	)

	await expect(page.getByText('DrawFrames Axes')).toBeVisible()
	await expect(page.getByText('DrawFrames Sphere')).toBeVisible()
	await expect(page.getByText('DrawFrames Capsule:Capsule')).toBeVisible()

	await assertTestSuccess(page, testPrefix)
})

test('draw geometries', async ({ browser }) => {
	const testPrefix = 'DRAW_GEOMETRIES'
	const page = await createPage(browser)

	execSync(
		'go test -run ^TestDrawGeometries$/DrawGeometries github.com/viam-labs/motion-tools/client/api -count=1',
		{
			encoding: 'utf8',
		}
	)

	await expect(page.getByText('DrawGeometries Box')).toBeVisible()
	await expect(page.getByText('DrawGeometries Sphere')).toBeVisible()
	await expect(page.getByText('DrawGeometries Capsule')).toBeVisible()
	await expect(page.getByText('DrawGeometries Mesh')).toBeVisible()
	await expect(page.getByText('DrawGeometries PointCloud')).toBeVisible()

	await assertTestSuccess(page, testPrefix)
})

test('draw geometry', async ({ browser }) => {
	const testPrefix = 'DRAW_GEOMETRY'
	const page = await createPage(browser)

	execSync(
		'go test -run "^TestDrawGeometry$/(DrawGeometry_box|DrawGeometry_sphere|DrawGeometry_capsule|DrawGeometry_mesh)" github.com/viam-labs/motion-tools/client/api -count=1',
		{
			encoding: 'utf8',
		}
	)

	await expect(page.getByText('DrawGeometry box')).toBeVisible()
	await expect(page.getByText('DrawGeometry sphere')).toBeVisible()
	await expect(page.getByText('DrawGeometry capsule')).toBeVisible()
	await expect(page.getByText('DrawGeometry mesh')).toBeVisible()

	await assertTestSuccess(page, testPrefix)
})

test('draw geometry updating', async ({ browser }) => {
	const testPrefix = 'DRAW_GEOMETRY_UPDATING'
	const page = await createPage(browser)

	execSync(
		'go test -run "^TestDrawGeometry$/DrawGeometry_updating" github.com/viam-labs/motion-tools/client/api -count=1',
		{
			encoding: 'utf8',
		}
	)

	await expect(page.getByText('DrawGeometry box updating')).toBeVisible()

	await assertTestSuccess(page, testPrefix)
})

test('draw point cloud', async ({ browser }) => {
	const testPrefix = 'DRAW_POINT_CLOUD'
	const page = await createPage(browser)

	execSync(
		'go test -run ^TestDrawPointCloud$/DrawPointClouds github.com/viam-labs/motion-tools/client/api -count=1',
		{
			encoding: 'utf8',
		}
	)

	await expect(page.getByText('octagon')).toBeVisible()
	await expect(page.getByText('Zaghetto')).toBeVisible()
	await expect(page.getByText('simple')).toBeVisible()
	await expect(page.getByText('boat')).toBeVisible()

	await assertTestSuccess(page, testPrefix)
})

test('draw point cloud updating', async ({ browser }) => {
	const testPrefix = 'DRAW_POINT_CLOUD_UPDATING'
	const page = await createPage(browser)

	execSync(
		'go test -run ^TestDrawPointCloudUpdating$/DrawPointCloudUpdating github.com/viam-labs/motion-tools/client/api -count=1',
		{
			encoding: 'utf8',
		}
	)

	await expect(page.getByText('DrawPointCloud updating')).toBeVisible()

	await assertTestSuccess(page, testPrefix)
})

test('draw point cloud in chunks', async ({ browser }) => {
	await runChunkedTest(
		browser,
		'DRAW_POINT_CLOUD_IN_CHUNKS',
		'^TestDrawPointCloud$/^DrawPointCloudInChunks$'
	)
})

test('draw point cloud in chunks with palette', async ({ browser }) => {
	await runChunkedTest(
		browser,
		'DRAW_POINT_CLOUD_IN_CHUNKS_WITH_PALETTE',
		'^TestDrawPointCloud$/DrawPointCloudInChunksWithPalette'
	)
})

test('draw point cloud in chunks with per point colors', async ({ browser }) => {
	await runChunkedTest(
		browser,
		'DRAW_POINT_CLOUD_IN_CHUNKS_WITH_PER_POINT_COLORS',
		'^TestDrawPointCloud$/DrawPointCloudInChunksWithPerPointColors'
	)
})

test('draw point cloud in chunks with uniform opacity', async ({ browser }) => {
	await runChunkedTest(
		browser,
		'DRAW_POINT_CLOUD_IN_CHUNKS_WITH_UNIFORM_OPACITY',
		'^TestDrawPointCloud$/DrawPointCloudInChunksWithUniformOpacity'
	)
})

test('draw geometries updating', async ({ browser }) => {
	const testPrefix = 'DRAW_GEOMETRIES_UPDATING'
	const page = await createPage(browser)

	execSync(
		'go test -run ^TestDrawGeometriesUpdating$/DrawGeometriesUpdating github.com/viam-labs/motion-tools/client/api -count=1',
		{
			encoding: 'utf8',
		}
	)

	await expect(page.getByText('DrawGeometries box1 updating')).toBeVisible()
	await expect(page.getByText('DrawGeometries box2 updating')).toBeVisible()
	await expect(page.getByText('DrawGeometries box3 updating')).toBeVisible()

	await assertTestSuccess(page, testPrefix)
})

test('draw world state', async ({ browser }) => {
	const testPrefix = 'DRAW_WORLD_STATE'
	const page = await createPage(browser)

	execSync(
		'go test -run ^TestDrawWorldState$/DrawWorldState github.com/viam-labs/motion-tools/client/api -count=1',
		{
			encoding: 'utf8',
		}
	)

	await expect(page.getByText('box0')).toBeVisible()
	await expect(page.getByText('box1')).toBeVisible()
	await expect(page.getByText('box2')).toBeVisible()

	await assertTestSuccess(page, testPrefix)
})

test('draw nurbs', async ({ browser }) => {
	const testPrefix = 'DRAW_NURBS'
	const page = await createPage(browser)

	execSync(
		'go test -run ^TestDrawNurbs$/DrawNurbs github.com/viam-labs/motion-tools/client/api -count=1',
		{
			encoding: 'utf8',
		}
	)

	await expect(page.getByText('nurbs-1')).toBeVisible()

	await assertTestSuccess(page, testPrefix)
})

test('draw lines', async ({ browser }) => {
	const testPrefix = 'DRAW_LINE'
	const page = await createPage(browser)

	execSync(
		'go test -run ^TestDrawLine$/DrawLine$ github.com/viam-labs/motion-tools/client/api -count=1',
		{
			encoding: 'utf8',
		}
	)

	await expect(page.getByText('upwardSpiral')).toBeVisible()

	await assertTestSuccess(page, testPrefix)
})

test('draw lines with line color', async ({ browser }) => {
	const testPrefix = 'DRAW_LINE_WITH_LINE_COLOR'
	const page = await createPage(browser)

	execSync(
		'go test -run ^TestDrawLine$/DrawLineWithLineColor$ github.com/viam-labs/motion-tools/client/api -count=1',
		{
			encoding: 'utf8',
		}
	)

	await expect(page.getByText('upwardSpiralLineColor')).toBeVisible()

	await assertTestSuccess(page, testPrefix)
})

test('draw lines with dot color', async ({ browser }) => {
	const testPrefix = 'DRAW_LINE_WITH_DOT_COLOR'
	const page = await createPage(browser)

	execSync(
		'go test -run ^TestDrawLine$/DrawLineWithDotColor$ github.com/viam-labs/motion-tools/client/api -count=1',
		{
			encoding: 'utf8',
		}
	)

	await expect(page.getByText('upwardSpiralDotColor')).toBeVisible()

	await assertTestSuccess(page, testPrefix)
})

test('draw lines with line width', async ({ browser }) => {
	const testPrefix = 'DRAW_LINE_WITH_LINE_WIDTH'
	const page = await createPage(browser)

	execSync(
		'go test -run ^TestDrawLine$/DrawLineWithLineWidth$ github.com/viam-labs/motion-tools/client/api -count=1',
		{
			encoding: 'utf8',
		}
	)

	await expect(page.getByText('upwardSpiralLineWidth')).toBeVisible()

	await assertTestSuccess(page, testPrefix)
})

test('draw lines with dot size', async ({ browser }) => {
	const testPrefix = 'DRAW_LINE_WITH_DOT_SIZE'
	const page = await createPage(browser)

	execSync(
		'go test -run ^TestDrawLine$/DrawLineWithDotSize$ github.com/viam-labs/motion-tools/client/api -count=1',
		{
			encoding: 'utf8',
		}
	)

	await expect(page.getByText('upwardSpiralDotSize')).toBeVisible()

	await assertTestSuccess(page, testPrefix)
})

test('draw lines with line color palette', async ({ browser }) => {
	const testPrefix = 'DRAW_LINE_WITH_LINE_COLOR_PALETTE'
	const page = await createPage(browser)

	execSync(
		'go test -run ^TestDrawLine$/DrawLineWithLineColorPalette$ github.com/viam-labs/motion-tools/client/api -count=1',
		{
			encoding: 'utf8',
		}
	)

	await expect(page.getByText('upwardSpiralLineColorPalette')).toBeVisible()

	await assertTestSuccess(page, testPrefix)
})

test('draw lines with per-line colors', async ({ browser }) => {
	const testPrefix = 'DRAW_LINE_WITH_PER_LINE_COLORS'
	const page = await createPage(browser)

	execSync(
		'go test -run ^TestDrawLine$/DrawLineWithPerLineColors$ github.com/viam-labs/motion-tools/client/api -count=1',
		{
			encoding: 'utf8',
		}
	)

	await expect(page.getByText('upwardSpiralPerLineColors')).toBeVisible()

	await assertTestSuccess(page, testPrefix)
})

test('draw lines with dot color palette', async ({ browser }) => {
	const testPrefix = 'DRAW_LINE_WITH_DOT_COLOR_PALETTE'
	const page = await createPage(browser)

	execSync(
		'go test -run ^TestDrawLine$/DrawLineWithDotColorPalette$ github.com/viam-labs/motion-tools/client/api -count=1',
		{
			encoding: 'utf8',
		}
	)

	await expect(page.getByText('upwardSpiralDotColorPalette')).toBeVisible()

	await assertTestSuccess(page, testPrefix)
})

test('draw lines with per-dot colors', async ({ browser }) => {
	const testPrefix = 'DRAW_LINE_WITH_PER_DOT_COLORS'
	const page = await createPage(browser)

	execSync(
		'go test -run ^TestDrawLine$/DrawLineWithPerDotColors$ github.com/viam-labs/motion-tools/client/api -count=1',
		{
			encoding: 'utf8',
		}
	)

	await expect(page.getByText('upwardSpiralPerDotColors')).toBeVisible()

	await assertTestSuccess(page, testPrefix)
})

test('draw points', async ({ browser }) => {
	const testPrefix = 'DRAW_POINTS'
	const page = await createPage(browser)

	execSync(
		'go test -run ^TestDrawPoints$/DrawPoints$ github.com/viam-labs/motion-tools/client/api -count=1',
		{
			encoding: 'utf8',
		}
	)

	await expect(page.getByText('myPoints')).toBeVisible()

	await assertTestSuccess(page, testPrefix)
})

test('draw points with single color', async ({ browser }) => {
	const testPrefix = 'DRAW_POINTS_WITH_SINGLE_COLOR'
	const page = await createPage(browser)

	execSync(
		'go test -run ^TestDrawPoints$/DrawPointsWithSingleColor$ github.com/viam-labs/motion-tools/client/api -count=1',
		{
			encoding: 'utf8',
		}
	)

	await expect(page.getByText('myPointsSingleColor')).toBeVisible()

	await assertTestSuccess(page, testPrefix)
})

test('draw points with color palette', async ({ browser }) => {
	const testPrefix = 'DRAW_POINTS_WITH_COLOR_PALETTE'
	const page = await createPage(browser)

	execSync(
		'go test -run ^TestDrawPoints$/DrawPointsWithColorPalette$ github.com/viam-labs/motion-tools/client/api -count=1',
		{
			encoding: 'utf8',
		}
	)

	await expect(page.getByText('myPointsPalette')).toBeVisible()

	await assertTestSuccess(page, testPrefix)
})

test('draw points with per point color', async ({ browser }) => {
	const testPrefix = 'DRAW_POINTS_WITH_PER_POINT_COLOR'
	const page = await createPage(browser)

	execSync(
		'go test -run ^TestDrawPoints$/DrawPointsWithPerPointColors$ github.com/viam-labs/motion-tools/client/api -count=1',
		{
			encoding: 'utf8',
		}
	)

	await expect(page.getByText('myPointsPerPoint')).toBeVisible()

	await assertTestSuccess(page, testPrefix)
})

test('draw points with point size', async ({ browser }) => {
	const testPrefix = 'DRAW_POINTS_WITH_POINT_SIZE'
	const page = await createPage(browser)

	execSync(
		'go test -run ^TestDrawPoints$/DrawPointsWithPointSize$ github.com/viam-labs/motion-tools/client/api -count=1',
		{
			encoding: 'utf8',
		}
	)

	await expect(page.getByText('myPointsWithSize')).toBeVisible()

	await assertTestSuccess(page, testPrefix)
})

test('draw points in chunks', async ({ browser }) => {
	await runChunkedTest(browser, 'DRAW_POINTS_IN_CHUNKS', '^TestDrawPoints$/DrawPointsInChunks')
})

test('draw poses as arrows', async ({ browser }) => {
	const testPrefix = 'DRAW_POSES_AS_ARROWS'
	const page = await createPage(browser)

	execSync(
		'go test -run ^TestDrawPosesAsArrows$/DrawPosesAsArrows$ github.com/viam-labs/motion-tools/client/api -count=1',
		{
			encoding: 'utf8',
		}
	)

	await expect(page.getByText('mySpherePoses', { exact: true })).toBeVisible()
	await expect(page.getByText('mySphere', { exact: true })).toBeVisible()

	await assertTestSuccess(page, testPrefix)
})

test('draw poses as arrows with color palette', async ({ browser }) => {
	const testPrefix = 'DRAW_POSES_AS_ARROWS_WITH_COLOR_PALETTE'
	const page = await createPage(browser)

	execSync(
		'go test -run ^TestDrawPosesAsArrows$/DrawPosesAsArrowsWithColorPalette$ github.com/viam-labs/motion-tools/client/api -count=1',
		{
			encoding: 'utf8',
		}
	)

	await expect(page.getByText('mySpherePoses', { exact: true })).toBeVisible()
	await expect(page.getByText('mySphere', { exact: true })).toBeVisible()

	await assertTestSuccess(page, testPrefix)
})

test('draw poses as arrows with single color', async ({ browser }) => {
	const testPrefix = 'DRAW_POSES_AS_ARROWS_WITH_SINGLE_COLOR'
	const page = await createPage(browser)

	execSync(
		'go test -run ^TestDrawPosesAsArrows$/DrawPosesAsArrowsWithSingleColor$ github.com/viam-labs/motion-tools/client/api -count=1',
		{
			encoding: 'utf8',
		}
	)

	await expect(page.getByText('mySpherePoses', { exact: true })).toBeVisible()
	await expect(page.getByText('mySphere', { exact: true })).toBeVisible()

	await assertTestSuccess(page, testPrefix)
})

test('draw poses as arrows with per point color', async ({ browser }) => {
	const testPrefix = 'DRAW_POSES_AS_ARROWS_WITH_PER_POINT_COLOR'
	const page = await createPage(browser)

	execSync(
		'go test -run ^TestDrawPosesAsArrows$/DrawPosesAsArrowsWithPerPointColors$ github.com/viam-labs/motion-tools/client/api -count=1',
		{
			encoding: 'utf8',
		}
	)

	await expect(page.getByText('mySpherePoses', { exact: true })).toBeVisible()
	await expect(page.getByText('mySphere', { exact: true })).toBeVisible()

	await assertTestSuccess(page, testPrefix)
})

test('draw gltf', async ({ browser }) => {
	const testPrefix = 'DRAW_GLTF'
	const page = await createPage(browser)

	execSync(
		'go test -run ^TestDrawGLTF$/DrawGLTF github.com/viam-labs/motion-tools/client/api -count=1',
		{
			encoding: 'utf8',
		}
	)

	await expect(page.getByText('flamingo', { exact: true })).toBeVisible()

	await assertTestSuccess(page, testPrefix)
})

test('draw point clouds', async ({ browser }) => {
	const testPrefix = 'DRAW_POINT_CLOUDS'
	const page = await createPage(browser)

	execSync(
		'go test -run ^TestDrawPointCloud$/DrawPointClouds github.com/viam-labs/motion-tools/client/api -count=1',
		{
			encoding: 'utf8',
		}
	)

	await page.getByText('octagon').waitFor({ state: 'visible' })
	await page.getByText('Zaghetto').waitFor({ state: 'visible' })
	await page.getByText('simple').waitFor({ state: 'visible' })
	await page.getByText('boat').waitFor({ state: 'visible' })

	await assertTestSuccess(page, testPrefix)
})

test('draw point clouds with downscaling', async ({ browser }) => {
	const testPrefix = 'DRAW_POINT_CLOUDS_WITH_DOWNSCALING'
	const page = await createPage(browser)

	execSync(
		'go test -run ^TestDrawPointCloud$/DrawPointCloudWithDownscaling github.com/viam-labs/motion-tools/client/api -count=1',
		{
			encoding: 'utf8',
		}
	)

	await expect(page.getByText('boat_downscaled')).toBeVisible()

	await assertTestSuccess(page, testPrefix)
})

test('draw point clouds with single color', async ({ browser }) => {
	const testPrefix = 'DRAW_POINT_CLOUDS_WITH_SINGLE_COLOR'
	const page = await createPage(browser)

	execSync(
		'go test -run ^TestDrawPointCloud$/DrawSingleColorPointCloud github.com/viam-labs/motion-tools/client/api -count=1',
		{
			encoding: 'utf8',
		}
	)

	await expect(page.getByText('octagon_single_color')).toBeVisible()

	await assertTestSuccess(page, testPrefix)
})

test('draw point cloud with opacity', async ({ browser }) => {
	const testPrefix = 'DRAW_POINT_CLOUD_WITH_OPACITY'
	const page = await createPage(browser)

	execSync(
		'go test -run ^TestDrawPointCloud$/DrawSingleColorPointCloudWithOpacity github.com/viam-labs/motion-tools/client/api -count=1',
		{
			encoding: 'utf8',
		}
	)

	await expect(page.getByText('octagon_with_opacity')).toBeVisible()

	await assertTestSuccess(page, testPrefix)
})

test('draw point clouds with color palette', async ({ browser }) => {
	const testPrefix = 'DRAW_POINT_CLOUDS_WITH_COLOR_PALETTE'
	const page = await createPage(browser)

	execSync(
		'go test -run ^TestDrawPointCloud$/DrawPaletteColorPointCloud github.com/viam-labs/motion-tools/client/api -count=1',
		{
			encoding: 'utf8',
		}
	)

	await expect(page.getByText('Zaghetto_palette')).toBeVisible()

	await assertTestSuccess(page, testPrefix)
})

test('draw point clouds with per point color', async ({ browser }) => {
	const testPrefix = 'DRAW_POINT_CLOUDS_WITH_PER_POINT_COLOR'
	const page = await createPage(browser)

	execSync(
		'go test -run ^TestDrawPointCloud$/DrawPerPointColorPointCloud github.com/viam-labs/motion-tools/client/api -count=1',
		{
			encoding: 'utf8',
		}
	)

	await expect(page.getByText('simple_per_point')).toBeVisible()

	await assertTestSuccess(page, testPrefix)
})

test('set camera pose', async ({ browser }) => {
	const testPrefix = 'SET_CAMERA_POSE'
	const page = await createPage(browser)
	const failedScreenshots: string[] = []

	execSync(
		'go test -run ^TestSetCamera$/SetCameraTopDown github.com/viam-labs/motion-tools/client/api -count=1',
		{
			encoding: 'utf8',
		}
	)

	await expect(page.getByText('reference_box')).toBeVisible()

	const setCameraScreenshot = await takeScreenshot(page, `${testPrefix}_SET_CAMERA`)
	failedScreenshots.push(setCameraScreenshot)

	execSync(
		'go test -run ^TestSetCamera$/ResetCamera github.com/viam-labs/motion-tools/client/api -count=1',
		{
			encoding: 'utf8',
		}
	)

	const resetCameraScreenshot = await takeScreenshot(page, `${testPrefix}_RESET_CAMERA`)
	failedScreenshots.push(resetCameraScreenshot)

	await cleanup(page)

	assertNoFailedScreenshots(failedScreenshots)
})

test('remove all', async ({ browser }) => {
	const testPrefix = 'REMOVE_ALL'
	const page = await createPage(browser)
	const failedScreenshots: string[] = []

	execSync(
		'go test -run ^TestRemoveAll$/RemoveAllSetup github.com/viam-labs/motion-tools/client/api -count=1',
		{
			encoding: 'utf8',
		}
	)

	await expect(page.getByText('box2delete')).toBeVisible({ timeout: 10000 })
	failedScreenshots.push(await takeScreenshot(page, `${testPrefix}_SETUP`))

	execSync(
		'go test -run ^TestRemoveAll$/RemoveAll github.com/viam-labs/motion-tools/client/api -count=1',
		{
			encoding: 'utf8',
		}
	)

	await expect(page.getByText('box2delete')).not.toBeVisible({ timeout: 10000 })
	failedScreenshots.push(await takeScreenshot(page, testPrefix))

	await cleanup(page)

	assertNoFailedScreenshots(failedScreenshots)
})

test('remove drawings', async ({ browser }) => {
	const testPrefix = 'REMOVE_DRAWINGS'
	const page = await createPage(browser)
	const failedScreenshots: string[] = []

	execSync(
		'go test -run ^TestRemoveDrawings$/RemoveDrawingsSetup github.com/viam-labs/motion-tools/client/api -count=1',
		{
			encoding: 'utf8',
		}
	)

	await expect(page.getByText('box2delete')).toBeVisible({ timeout: 10000 })
	failedScreenshots.push(await takeScreenshot(page, `${testPrefix}_SETUP`))

	execSync(
		'go test -run ^TestRemoveDrawings$/RemoveDrawings github.com/viam-labs/motion-tools/client/api -count=1',
		{
			encoding: 'utf8',
		}
	)

	await expect(page.getByText('box2delete')).toBeVisible({ timeout: 10000 })
	failedScreenshots.push(await takeScreenshot(page, testPrefix))

	await cleanup(page)

	assertNoFailedScreenshots(failedScreenshots)
})

test('remove transforms', async ({ browser }) => {
	const testPrefix = 'REMOVE_TRANSFORMS'
	const page = await createPage(browser)
	const failedScreenshots: string[] = []

	execSync(
		'go test -run ^TestRemoveTransforms$/RemoveTransformsSetup github.com/viam-labs/motion-tools/client/api -count=1',
		{
			encoding: 'utf8',
		}
	)

	await expect(page.getByText('box2delete')).toBeVisible({ timeout: 10000 })
	failedScreenshots.push(await takeScreenshot(page, `${testPrefix}_SETUP`))

	execSync(
		'go test -run ^TestRemoveTransforms$/RemoveTransforms github.com/viam-labs/motion-tools/client/api -count=1',
		{
			encoding: 'utf8',
		}
	)

	await expect(page.getByText('box2delete')).not.toBeVisible({ timeout: 10000 })
	failedScreenshots.push(await takeScreenshot(page, testPrefix))

	await cleanup(page)

	assertNoFailedScreenshots(failedScreenshots)
})

test('replay', async ({ browser }) => {
	const testPrefix = 'REPLAY'
	const page = await createPage(browser)
	const failedScreenshots: string[] = []

	execSync(
		'go test -run ^TestReplay$/ReplayRecord github.com/viam-labs/motion-tools/client/api -count=1',
		{
			encoding: 'utf8',
		}
	)

	await expect(page.getByText('bouncing_ball')).toBeVisible()

	const recordScreenshot = await takeScreenshot(page, `${testPrefix}_RECORD`)
	failedScreenshots.push(recordScreenshot)

	await cleanup(page)

	execSync(
		'go test -run ^TestReplay$/ReplayPlayback github.com/viam-labs/motion-tools/client/api -count=1',
		{
			encoding: 'utf8',
		}
	)

	await expect(page.getByText('bouncing_ball')).toBeVisible()

	const playbackScreenshot = await takeScreenshot(page, `${testPrefix}_PLAYBACK`)
	failedScreenshots.push(playbackScreenshot)

	await cleanup(page)

	assertNoFailedScreenshots(failedScreenshots)
})

test('relationships', async ({ browser }) => {
	const page = await createPage(browser)
	const failedScreenshots: string[] = []

	execSync(
		'go test -run ^TestRelationships$/Setup github.com/viam-labs/motion-tools/client/api -count=1',
		{ encoding: 'utf8' }
	)

	await expect(page.getByText('rel-source', { exact: true })).toBeVisible({ timeout: 10000 })
	await expect(page.getByText('rel-target', { exact: true })).toBeVisible({ timeout: 10000 })

	execSync(
		'go test -run ^TestRelationships$/CreateRelationship github.com/viam-labs/motion-tools/client/api -count=1',
		{ encoding: 'utf8' }
	)

	await page.locator('[data-part="item"]').filter({ hasText: 'rel-source' }).click()
	await expect(page.getByText('rel-target (HoverLink)')).toBeVisible({ timeout: 10000 })
	failedScreenshots.push(await takeScreenshot(page, 'RELATIONSHIPS_CREATED'))

	await page.reload()
	await expect(page.getByText('World', { exact: true })).toBeVisible({ timeout: 10000 })
	await expect(page.getByText('rel-source', { exact: true })).toBeVisible({ timeout: 15000 })
	await expect(page.getByText('rel-target', { exact: true })).toBeVisible({ timeout: 15000 })
	await page.locator('[data-part="item"]').filter({ hasText: 'rel-source' }).click()
	await expect(page.getByText('rel-target (HoverLink)')).toBeVisible({ timeout: 10000 })

	execSync(
		'go test -run ^TestRelationships$/DeleteRelationship github.com/viam-labs/motion-tools/client/api -count=1',
		{ encoding: 'utf8' }
	)

	await expect(page.getByText('rel-target (HoverLink)')).not.toBeVisible({ timeout: 10000 })
	failedScreenshots.push(await takeScreenshot(page, 'RELATIONSHIPS_DELETED'))

	await cleanup(page)

	assertNoFailedScreenshots(failedScreenshots)
})
