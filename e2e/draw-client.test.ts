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
			encoding: 'utf-8',
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
			encoding: 'utf-8',
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
			encoding: 'utf-8',
		}
	)

	await expect(page.getByText('DrawFrames Axes')).toBeVisible()
	await expect(page.getByText('DrawFrames Sphere')).toBeVisible()
	await expect(page.getByText('DrawGeometries Capsule')).toBeVisible()

	await assertTestSuccess(page, testPrefix)
})
