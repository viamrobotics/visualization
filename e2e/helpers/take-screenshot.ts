import { Page, PageAssertionsToHaveScreenshotOptions, expect } from '@playwright/test'

export const takeScreenshot = async (
	page: Page,
	testPrefix: string,
	failedScreenshots: string[],
	options: PageAssertionsToHaveScreenshotOptions = {
		fullPage: true,
		threshold: 0.1,
	}
) => {
	// Wait for any rendering to stabilize
	await page.evaluate(() => {
		return new Promise<void>((resolve) => {
			requestAnimationFrame(() => {
				resolve()
			})
		})
	})

	try {
		await expect(page).toHaveScreenshot(`${testPrefix}.png`, options)
	} catch (error) {
		console.warn(error)
		failedScreenshots.push(`${testPrefix}.png`)
	}
}

export const assertNoFailedScreenshots = (failedScreenshots: string[]) => {
	if (failedScreenshots.length > 0) {
		console.log(`Failed screenshots: ${failedScreenshots.join(', ')}`)
		throw new Error(`Failed screenshots: ${failedScreenshots.join(', ')}`)
	}
}
