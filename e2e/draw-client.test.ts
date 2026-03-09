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
