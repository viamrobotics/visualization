import { Browser, expect, Page, test } from '@playwright/test'
import { execSync } from 'child_process'

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

const takeScreenshot = async (page: Page, testPrefix: string, failedScreenshots: string[]) => {
	try {
		await expect(page).toHaveScreenshot(`${testPrefix}.png`, {
			fullPage: true,
			threshold: 0.1,
		})
	} catch (error) {
		console.warn(error)
		failedScreenshots.push(`${testPrefix}.png`)
	}
}

const assertNoFailedScreenshots = (failedScreenshots: string[]) => {
	if (failedScreenshots.length > 0) {
		console.log(`Failed screenshots: ${failedScreenshots.join(', ')}`)
		throw new Error(`Failed screenshots: ${failedScreenshots.join(', ')}`)
	}
}

const cleanup = () => {
	execSync(
		'go test -run ^TestRemoveAllSpatialObjects$/RemoveAllHelper github.com/viam-labs/motion-tools/client/server -count=1',
		{
			encoding: 'utf-8',
		}
	)
}

test('draw frame system', async ({ browser }) => {
	const testPrefix = 'DRAW_FRAME_SYSTEM'
	const failedScreenshots = [] as string[]
	const page = await createPage(browser)

	execSync(
		'go test -run ^TestDrawFrameSystem$/DrawFrameSystem github.com/viam-labs/motion-tools/client/server -count=1',
		{
			encoding: 'utf-8',
		}
	)

	await takeScreenshot(page, testPrefix, failedScreenshots)

	assertNoFailedScreenshots(failedScreenshots)
	cleanup()
})

test('draw frames', async ({ browser }) => {
	const testPrefix = 'DRAW_FRAMES'
	const failedScreenshots = [] as string[]
	const page = await createPage(browser)

	execSync(
		'go test -run ^TestDrawFrames$/DrawFrames github.com/viam-labs/motion-tools/client/server -count=1',
		{
			encoding: 'utf-8',
		}
	)
	await takeScreenshot(page, testPrefix, failedScreenshots)

	assertNoFailedScreenshots(failedScreenshots)
	cleanup()
})

test('draw geometries', async ({ browser }) => {
	const testPrefix = 'DRAW_GEOMETRIES'
	const failedScreenshots = [] as string[]
	const page = await createPage(browser)

	execSync(
		'go test -run ^TestDrawGeometries$/DrawGeometries github.com/viam-labs/motion-tools/client/server -count=1',
		{
			encoding: 'utf-8',
		}
	)
	await takeScreenshot(page, testPrefix, failedScreenshots)

	assertNoFailedScreenshots(failedScreenshots)
	cleanup()
})

test('draw geometries updating', async ({ browser }) => {
	const testPrefix = 'DRAW_GEOMETRIES_UPDATING'
	const failedScreenshots = [] as string[]
	const page = await createPage(browser)

	execSync(
		'go test -run ^TestDrawGeometriesUpdating$/DrawGeometriesUpdating github.com/viam-labs/motion-tools/client/server -count=1',
		{
			encoding: 'utf-8',
		}
	)
	await takeScreenshot(page, testPrefix, failedScreenshots)

	assertNoFailedScreenshots(failedScreenshots)
	cleanup()
})

test('draw gltf', async ({ browser }) => {
	const testPrefix = 'DRAW_GLTF'
	const failedScreenshots = [] as string[]
	const page = await createPage(browser)

	execSync(
		'go test -run ^TestDrawGLTF$/DrawGLTF github.com/viam-labs/motion-tools/client/server -count=1',
		{
			encoding: 'utf-8',
		}
	)
	await takeScreenshot(page, testPrefix, failedScreenshots)

	assertNoFailedScreenshots(failedScreenshots)
	cleanup()
})

test('draw lines', async ({ browser }) => {
	const testPrefix = 'DRAW_LINE'
	const failedScreenshots = [] as string[]
	const page = await createPage(browser)

	execSync(
		'go test -run ^TestDrawLine$/DrawLine github.com/viam-labs/motion-tools/client/server -count=1',
		{
			encoding: 'utf-8',
		}
	)
	await takeScreenshot(page, testPrefix, failedScreenshots)

	assertNoFailedScreenshots(failedScreenshots)
	cleanup()
})

test('draw nurbs', async ({ browser }) => {
	const testPrefix = 'DRAW_NURBS'
	const failedScreenshots = [] as string[]
	const page = await createPage(browser)

	execSync(
		'go test -run ^TestDrawNurbs$/DrawNurbs github.com/viam-labs/motion-tools/client/server -count=1',
		{
			encoding: 'utf-8',
		}
	)
	await takeScreenshot(page, testPrefix, failedScreenshots)

	assertNoFailedScreenshots(failedScreenshots)
	cleanup()
})

test('draw point clouds', async ({ browser }) => {
	const testPrefix = 'DRAW_POINT_CLOUDS'
	const failedScreenshots = [] as string[]
	const page = await createPage(browser)

	execSync(
		'go test -run ^TestDrawPointCloud$/DrawPointClouds github.com/viam-labs/motion-tools/client/server -count=1',
		{
			encoding: 'utf-8',
		}
	)

	await page.getByText('octagon').waitFor({ state: 'visible' })
	await page.getByText('Zaghetto').waitFor({ state: 'visible' })
	await page.getByText('simple').waitFor({ state: 'visible' })
	await page.getByText('boat').waitFor({ state: 'visible' })

	await takeScreenshot(page, testPrefix, failedScreenshots)

	assertNoFailedScreenshots(failedScreenshots)
	cleanup()
})

test('draw point clouds with downscaling', async ({ browser }) => {
	const testPrefix = 'DRAW_POINT_CLOUDS_WITH_DOWNSCALING'
	const failedScreenshots = [] as string[]
	const page = await createPage(browser)

	execSync(
		'go test -run ^TestDrawPointCloud$/DrawPointCloudWithDownscaling github.com/viam-labs/motion-tools/client/server -count=1',
		{
			encoding: 'utf-8',
		}
	)
	await takeScreenshot(page, testPrefix, failedScreenshots)

	assertNoFailedScreenshots(failedScreenshots)
	cleanup()
})

test('draw point clouds with single color', async ({ browser }) => {
	const testPrefix = 'DRAW_POINT_CLOUDS_WITH_SINGLE_COLOR'
	const failedScreenshots = [] as string[]
	const page = await createPage(browser)

	execSync(
		'go test -run ^TestDrawPointCloud$/DrawSingleColorPointCloud github.com/viam-labs/motion-tools/client/server -count=1',
		{
			encoding: 'utf-8',
		}
	)
	await takeScreenshot(page, testPrefix, failedScreenshots)

	assertNoFailedScreenshots(failedScreenshots)
	cleanup()
})

test('draw point clouds with color palette', async ({ browser }) => {
	const testPrefix = 'DRAW_POINT_CLOUDS_WITH_COLOR_PALETTE'
	const failedScreenshots = [] as string[]
	const page = await createPage(browser)

	execSync(
		'go test -run ^TestDrawPointCloud$/DrawPaletteColorPointCloud github.com/viam-labs/motion-tools/client/server -count=1',
		{
			encoding: 'utf-8',
		}
	)
	await takeScreenshot(page, testPrefix, failedScreenshots)

	assertNoFailedScreenshots(failedScreenshots)
	cleanup()
})

test('draw point clouds with per point color', async ({ browser }) => {
	const testPrefix = 'DRAW_POINT_CLOUDS_WITH_PER_POINT_COLOR'
	const failedScreenshots = [] as string[]
	const page = await createPage(browser)

	execSync(
		'go test -run ^TestDrawPointCloud$/DrawPerPointColorPointCloud github.com/viam-labs/motion-tools/client/server -count=1',
		{
			encoding: 'utf-8',
		}
	)
	await takeScreenshot(page, testPrefix, failedScreenshots)

	assertNoFailedScreenshots(failedScreenshots)
	cleanup()
})

test('draw points', async ({ browser }) => {
	const testPrefix = 'DRAW_POINTS'
	const failedScreenshots = [] as string[]
	const page = await createPage(browser)

	execSync(
		'go test -run ^TestDrawPoints$/DrawPoints github.com/viam-labs/motion-tools/client/server -count=1',
		{
			encoding: 'utf-8',
		}
	)
	await takeScreenshot(page, testPrefix, failedScreenshots)

	assertNoFailedScreenshots(failedScreenshots)
	cleanup()
})

test('draw poses', async ({ browser }) => {
	const testPrefix = 'DRAW_POSES'
	const failedScreenshots = [] as string[]
	const page = await createPage(browser)

	execSync(
		'go test -run ^TestDrawPosesAsArrows$/DrawPoses$ github.com/viam-labs/motion-tools/client/server -count=1',
		{
			encoding: 'utf-8',
		}
	)
	await takeScreenshot(page, testPrefix, failedScreenshots)

	assertNoFailedScreenshots(failedScreenshots)
	cleanup()
})

test('draw poses with color palette', async ({ browser }) => {
	const testPrefix = 'DRAW_POSES_WITH_COLOR_PALETTE'
	const failedScreenshots = [] as string[]
	const page = await createPage(browser)

	execSync(
		'go test -run ^TestDrawPosesAsArrows$/DrawAlternatingColorsPoses$ github.com/viam-labs/motion-tools/client/server -count=1',
		{
			encoding: 'utf-8',
		}
	)
	await takeScreenshot(page, testPrefix, failedScreenshots)

	assertNoFailedScreenshots(failedScreenshots)
	cleanup()
})

test('draw poses with single color', async ({ browser }) => {
	const testPrefix = 'DRAW_POSES_WITH_SINGLE_COLOR'
	const failedScreenshots = [] as string[]
	const page = await createPage(browser)

	execSync(
		'go test -run ^TestDrawPosesAsArrows$/DrawSingleColorPoses$ github.com/viam-labs/motion-tools/client/server -count=1',
		{
			encoding: 'utf-8',
		}
	)
	await takeScreenshot(page, testPrefix, failedScreenshots)

	assertNoFailedScreenshots(failedScreenshots)
	cleanup()
})

test('draw world state', async ({ browser }) => {
	const testPrefix = 'DRAW_WORLD_STATE'
	const failedScreenshots = [] as string[]
	const page = await createPage(browser)

	execSync(
		'go test -run ^TestDrawWorldState$/DrawWorldState github.com/viam-labs/motion-tools/client/server -count=1',
		{
			encoding: 'utf-8',
		}
	)
	await takeScreenshot(page, testPrefix, failedScreenshots)

	assertNoFailedScreenshots(failedScreenshots)
	cleanup()
})

test('remove all spatial objects', async ({ browser }) => {
	const testPrefix = 'REMOVE_ALL_SPATIAL_OBJECTS'
	const failedScreenshots = [] as string[]
	const page = await createPage(browser)

	execSync(
		'go test -run ^TestRemoveAllSpatialObjects$/RemoveAll github.com/viam-labs/motion-tools/client/server -count=1',
		{
			encoding: 'utf-8',
		}
	)
	await takeScreenshot(page, testPrefix, failedScreenshots)
	cleanup()
})

test('remove transforms', async ({ browser }) => {
	const testPrefix = 'REMOVE_TRANSFORMS'
	const failedScreenshots = [] as string[]
	const page = await createPage(browser)

	execSync(
		'go test -run ^TestRemoveTransforms$/RemoveTransforms github.com/viam-labs/motion-tools/client/server -count=1',
		{
			encoding: 'utf-8',
		}
	)
	await takeScreenshot(page, testPrefix, failedScreenshots)

	assertNoFailedScreenshots(failedScreenshots)
	cleanup()
})

test('remove drawings', async ({ browser }) => {
	const testPrefix = 'REMOVE_DRAWINGS'
	const failedScreenshots = [] as string[]
	const page = await createPage(browser)

	execSync(
		'go test -run ^TestRemoveDrawings$/RemoveDrawings github.com/viam-labs/motion-tools/client/server -count=1',
		{
			encoding: 'utf-8',
		}
	)
	await takeScreenshot(page, testPrefix, failedScreenshots)

	assertNoFailedScreenshots(failedScreenshots)
	cleanup()
})
