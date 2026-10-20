import { expect, type Page } from '@playwright/test'

const withOverlaysHidden = async <T>(page: Page, fn: () => Promise<T>): Promise<T> => {
	const canvas = page.locator('canvas').first()

	await canvas.evaluate((node) => {
		const hidden: HTMLElement[] = []
		let el: Element | null = node
		while (el && el.parentElement) {
			for (const sibling of el.parentElement.children) {
				if (sibling !== el && sibling instanceof HTMLElement) {
					hidden.push(sibling)
					sibling.dataset.screenshotPrevDisplay = sibling.style.display
					sibling.style.display = 'none'
				}
			}
			el = el.parentElement
		}
		;(globalThis as unknown as { __screenshotHidden: HTMLElement[] }).__screenshotHidden = hidden
	})

	try {
		return await fn()
	} finally {
		await page.evaluate(() => {
			const store = globalThis as unknown as { __screenshotHidden?: HTMLElement[] }
			for (const el of store.__screenshotHidden ?? []) {
				el.style.display = el.dataset.screenshotPrevDisplay ?? ''
				delete el.dataset.screenshotPrevDisplay
			}
			delete store.__screenshotHidden
		})
	}
}

/**
 * Soft so a multi-step test keeps going and reports every mismatch at once.
 * Playwright still fails the test, and unlike collecting names by hand it
 * keeps the diff, actual, and expected attachments.
 */
export const screenshotCanvas = (page: Page, name: string): Promise<void> =>
	withOverlaysHidden(page, async () => {
		await expect.soft(page.locator('canvas').first()).toHaveScreenshot(`${name}.png`)
	})

export const waitForCanvasToChange = async (
	page: Page,
	reference: Buffer,
	timeoutMs = 10000
): Promise<Buffer | null> => {
	return withOverlaysHidden(page, async () => {
		const canvas = page.locator('canvas').first()
		const deadline = Date.now() + timeoutMs
		while (Date.now() < deadline) {
			const current = await canvas.screenshot()
			if (!current.equals(reference)) {
				return current
			}
			await page.waitForTimeout(150)
		}
		return null
	})
}

/**
 * Wait until the canvas stops changing, then return the settled frame.
 *
 * `waitForCanvasToChange` returns on the first differing pixel, which can be a partially applied
 * update: an entity's mesh and its axes helper are flushed by separate batched renderers, so a
 * move can be visible on one before the other. Screenshotting at that point captures a torn
 * frame and makes a passing snapshot look like a bug. Wait for the scene to settle instead.
 */
export const waitForCanvasToSettle = async (
	page: Page,
	{ stableMs = 400, timeoutMs = 10000 }: { stableMs?: number; timeoutMs?: number } = {}
): Promise<Buffer> => {
	return withOverlaysHidden(page, async () => {
		const canvas = page.locator('canvas').first()
		const deadline = Date.now() + timeoutMs

		let previous = await canvas.screenshot()
		while (Date.now() < deadline) {
			await page.waitForTimeout(stableMs)
			const current = await canvas.screenshot()
			if (current.equals(previous)) {
				return current
			}
			previous = current
		}
		return previous
	})
}
