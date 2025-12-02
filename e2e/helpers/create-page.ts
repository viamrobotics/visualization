import { Browser, expect } from '@playwright/test'
import { cleanup } from './cleanup/cleanup'

export const createPage = async (browser: Browser) => {
	const failedScreenshots = [] as string[]
	const context = await browser.newContext()
	await context.addCookies([
		{
			name: 'weblab_experiments',
			value: 'MOTION_TOOLS_EDIT_FRAME',
			domain: 'localhost',
			path: '/',
		},
	])

	let page = await context.newPage()

	// Add console logging for debugging
	page.on('console', (message) => {
		console.log(`[${message.type()}] ${message.text()}`)
	})

	const load = async () => {
		await page.goto('/')
		await expect(page.getByRole('heading', { name: 'World' })).toBeVisible({ timeout: 15000 })
	}

	const refresh = async () => {
		page = await context.newPage()
		// Re-attach console logging on refresh
		page.on('console', (message) => {
			console.log(`[${message.type()}] ${message.text()}`)
		})
		await load()
	}

	await load()
	await page.waitForTimeout(5000)
	await cleanup(page)

	return { page, failedScreenshots, refresh }
}
