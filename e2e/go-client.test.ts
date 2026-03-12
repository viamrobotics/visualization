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

test('draw frame system', async ({ browser }) => {
	const testPrefix = 'DRAW_FRAME_SYSTEM'
	const failedScreenshots = [] as string[]
	const page = await createPage(browser)

	execSync(
		'go test -run ^TestDrawFrameSystem$/DrawFrameSystem github.com/viam-labs/motion-tools/client/client -count=1',
		{
			encoding: 'utf8',
		}
	)

	await takeScreenshot(page, testPrefix, failedScreenshots)

	assertNoFailedScreenshots(failedScreenshots)
})

test('draw hierarchy', async ({ browser }) => {
	const testPrefix = 'DRAW_HIERARCHY'
	const failedScreenshots = [] as string[]
	const page = await createPage(browser)

	execSync(
		'go test -run ^TestDrawHierarchy$/DrawHierarchy github.com/viam-labs/motion-tools/client/client -count=1',
		{
			encoding: 'utf8',
		}
	)

	// Root-level nodes are always visible
	await expect(page.getByText('zulu', { exact: true })).toBeVisible()
	await expect(page.getByText('bravo', { exact: true })).toBeVisible()

	// Expand "zulu" to reveal its children
	await page
		.locator('[data-part="branch-control"]')
		.filter({ hasText: 'zulu' })
		.locator('[data-part="branch-indicator"]')
		.click()
	await expect(page.getByText('tango', { exact: true })).toBeVisible()
	await expect(page.getByText('delta', { exact: true })).toBeVisible()

	await takeScreenshot(page, `${testPrefix}_ZULU_EXPANDED`, failedScreenshots)

	// Expand "tango" to reveal its children
	await page
		.locator('[data-part="branch-control"]')
		.filter({ hasText: 'tango' })
		.locator('[data-part="branch-indicator"]')
		.click()
	await expect(page.getByText('sierra', { exact: true })).toBeVisible()
	await expect(page.getByText('foxtrot', { exact: true })).toBeVisible()

	await takeScreenshot(page, `${testPrefix}_TANGO_EXPANDED`, failedScreenshots)

	assertNoFailedScreenshots(failedScreenshots)
})

test('draw frames', async ({ browser }) => {
	const testPrefix = 'DRAW_FRAMES'
	const failedScreenshots = [] as string[]
	const page = await createPage(browser)

	execSync(
		'go test -run ^TestDrawFrames$/DrawFrames github.com/viam-labs/motion-tools/client/client -count=1',
		{
			encoding: 'utf8',
		}
	)
	await takeScreenshot(page, testPrefix, failedScreenshots)

	assertNoFailedScreenshots(failedScreenshots)
})

test('draw geometries', async ({ browser }) => {
	const testPrefix = 'DRAW_GEOMETRIES'
	const failedScreenshots = [] as string[]
	const page = await createPage(browser)

	execSync(
		'go test -run ^TestDrawGeometries$/DrawGeometries github.com/viam-labs/motion-tools/client/client -count=1',
		{
			encoding: 'utf8',
		}
	)
	await takeScreenshot(page, testPrefix, failedScreenshots)

	assertNoFailedScreenshots(failedScreenshots)
})

test('draw geometries updating', async ({ browser }) => {
	const testPrefix = 'DRAW_GEOMETRIES_UPDATING'
	const failedScreenshots = [] as string[]
	const page = await createPage(browser)

	execSync(
		'go test -run ^TestDrawGeometriesUpdating$/DrawGeometriesUpdating github.com/viam-labs/motion-tools/client/client -count=1',
		{
			encoding: 'utf8',
		}
	)
	await takeScreenshot(page, testPrefix, failedScreenshots)

	assertNoFailedScreenshots(failedScreenshots)
})

test('draw gltf', async ({ browser }) => {
	const testPrefix = 'DRAW_GLTF'
	const failedScreenshots = [] as string[]
	const page = await createPage(browser)

	execSync(
		'go test -run ^TestDrawGLTF$/DrawGLTF github.com/viam-labs/motion-tools/client/client -count=1',
		{
			encoding: 'utf8',
		}
	)
	await takeScreenshot(page, testPrefix, failedScreenshots)

	assertNoFailedScreenshots(failedScreenshots)
})

test('draw lines', async ({ browser }) => {
	const testPrefix = 'DRAW_LINES'
	const failedScreenshots = [] as string[]
	const page = await createPage(browser)

	execSync(
		'go test -run ^TestDrawLines$/DrawLine github.com/viam-labs/motion-tools/client/client -count=1',
		{
			encoding: 'utf8',
		}
	)
	await takeScreenshot(page, testPrefix, failedScreenshots)

	assertNoFailedScreenshots(failedScreenshots)
})

test('draw point cloud', async ({ browser }) => {
	const testPrefix = 'DRAW_POINT_CLOUD'
	const failedScreenshots = [] as string[]
	const page = await createPage(browser)

	execSync(
		'go test -run ^TestDrawPointCloud$/DrawPointCloud github.com/viam-labs/motion-tools/client/client -count=1',
		{
			encoding: 'utf8',
		}
	)
	await takeScreenshot(page, testPrefix, failedScreenshots)

	assertNoFailedScreenshots(failedScreenshots)
})

test('draw points', async ({ browser }) => {
	const testPrefix = 'DRAW_POINTS'
	const failedScreenshots = [] as string[]
	const page = await createPage(browser)

	execSync(
		'go test -run ^TestDrawPoints$/DrawPoints github.com/viam-labs/motion-tools/client/client -count=1',
		{
			encoding: 'utf8',
		}
	)
	await takeScreenshot(page, testPrefix, failedScreenshots)

	assertNoFailedScreenshots(failedScreenshots)
})

test('draw poses', async ({ browser }) => {
	const testPrefix = 'DRAW_POSES'
	const failedScreenshots = [] as string[]
	const page = await createPage(browser)

	execSync(
		'go test -run ^TestDrawPoses$/DrawPoses$ github.com/viam-labs/motion-tools/client/client -count=1',
		{
			encoding: 'utf8',
		}
	)
	await takeScreenshot(page, testPrefix, failedScreenshots)

	assertNoFailedScreenshots(failedScreenshots)
})

test('draw poses with color palette', async ({ browser }) => {
	const testPrefix = 'DRAW_POSES_WITH_COLOR_PALETTE'
	const failedScreenshots = [] as string[]
	const page = await createPage(browser)

	execSync(
		'go test -run ^TestDrawPoses$/DrawAlternatingColorsPoses$ github.com/viam-labs/motion-tools/client/client -count=1',
		{
			encoding: 'utf8',
		}
	)
	await takeScreenshot(page, testPrefix, failedScreenshots)

	assertNoFailedScreenshots(failedScreenshots)
})

test('draw poses with single color', async ({ browser }) => {
	const testPrefix = 'DRAW_POSES_WITH_SINGLE_COLOR'
	const failedScreenshots = [] as string[]
	const page = await createPage(browser)

	execSync(
		'go test -run ^TestDrawPoses$/DrawSingleColorPoses$ github.com/viam-labs/motion-tools/client/client -count=1',
		{
			encoding: 'utf8',
		}
	)
	await takeScreenshot(page, testPrefix, failedScreenshots)

	assertNoFailedScreenshots(failedScreenshots)
})

test('draw world state', async ({ browser }) => {
	const testPrefix = 'DRAW_WORLD_STATE'
	const failedScreenshots = [] as string[]
	const page = await createPage(browser)

	execSync(
		'go test -run ^TestDrawWorldState$/DrawWorldState github.com/viam-labs/motion-tools/client/client -count=1',
		{
			encoding: 'utf8',
		}
	)
	await takeScreenshot(page, testPrefix, failedScreenshots)

	assertNoFailedScreenshots(failedScreenshots)
})

test('remove spatial objects', async ({ browser }) => {
	const testPrefix = 'REMOVE_SPATIAL_OBJECTS'
	const failedScreenshots = [] as string[]
	const page = await createPage(browser)

	execSync(
		'go test -run ^TestRemoveSpatialObjects$/RemoveSpatialObjects github.com/viam-labs/motion-tools/client/client -count=1',
		{
			encoding: 'utf8',
		}
	)
	await takeScreenshot(page, testPrefix, failedScreenshots)

	assertNoFailedScreenshots(failedScreenshots)
})

test('set camera pose', async ({ browser }) => {
	const testPrefix = 'SET_CAMERA_POSE'
	const failedScreenshots = [] as string[]
	const page = await createPage(browser)

	execSync(
		'go test -run ^TestSetCameraPose$/SetCameraPose github.com/viam-labs/motion-tools/client/client -count=1',
		{
			encoding: 'utf8',
		}
	)
	await takeScreenshot(page, testPrefix, failedScreenshots)

	assertNoFailedScreenshots(failedScreenshots)
})
