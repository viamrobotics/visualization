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

const cleanup = async (page: Page) => {
	execSync(
		'go test -run ^TestRemoveAll$/RemoveAllHelper github.com/viam-labs/motion-tools/client/api -count=1',
		{ encoding: 'utf8' }
	)
	await expect(page.getByText('No objects displayed', { exact: true })).toBeVisible({
		timeout: 15000,
	})
}

test('invisible entity cannot be selected from world tree', async ({ browser }) => {
	const page = await createPage(browser)

	execSync(
		'go test -run ^TestInvisible$/DrawInvisible github.com/viam-labs/motion-tools/client/api -count=1',
		{ encoding: 'utf8' }
	)

	await expect(page.getByText('invisible-box', { exact: true })).toBeVisible({ timeout: 10000 })

	await page.getByText('invisible-box', { exact: true }).click()
	// TODO: Attempt to click actual entity in 3D view and verify that details panel does not open, but for
	// now just verify that details panel does not open from world tree selection

	await expect(page.getByTestId('details-header')).not.toBeVisible()

	await cleanup(page)
})
