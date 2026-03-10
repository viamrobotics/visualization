import { Browser, expect, Page, test } from '@playwright/test'
import { execSync } from 'node:child_process'

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

test('draw lines with point color', async ({ browser }) => {
	const testPrefix = 'DRAW_LINE_WITH_POINT_COLOR'
	const page = await createPage(browser)

	execSync(
		'go test -run ^TestDrawLine$/DrawLineWithPointColor$ github.com/viam-labs/motion-tools/client/api -count=1',
		{
			encoding: 'utf8',
		}
	)

	await expect(page.getByText('upwardSpiralPointColor')).toBeVisible()

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

test('draw lines with point size', async ({ browser }) => {
	const testPrefix = 'DRAW_LINE_WITH_POINT_SIZE'
	const page = await createPage(browser)

	execSync(
		'go test -run ^TestDrawLine$/DrawLineWithPointSize$ github.com/viam-labs/motion-tools/client/api -count=1',
		{
			encoding: 'utf8',
		}
	)

	await expect(page.getByText('upwardSpiralPointSize')).toBeVisible()

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

	execSync(
		'go test -run ^TestRemoveAll$/RemoveAll github.com/viam-labs/motion-tools/client/api -count=1',
		{
			encoding: 'utf8',
		}
	)

	await assertTestSuccess(page, testPrefix)
})

test('remove drawings', async ({ browser }) => {
	const testPrefix = 'REMOVE_DRAWINGS'
	const page = await createPage(browser)

	execSync(
		'go test -run ^TestRemoveDrawings$/RemoveDrawings github.com/viam-labs/motion-tools/client/api -count=1',
		{
			encoding: 'utf8',
		}
	)

	await assertTestSuccess(page, testPrefix)
})

test('remove transforms', async ({ browser }) => {
	const testPrefix = 'REMOVE_TRANSFORMS'
	const page = await createPage(browser)

	execSync(
		'go test -run ^TestRemoveTransforms$/RemoveTransforms github.com/viam-labs/motion-tools/client/api -count=1',
		{
			encoding: 'utf8',
		}
	)

	await assertTestSuccess(page, testPrefix)
})
