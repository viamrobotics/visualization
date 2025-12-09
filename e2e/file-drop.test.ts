import { Browser, expect, Page, test } from '@playwright/test'
import * as fs from 'fs'
import * as path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

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

/**
 * Simulates a file drop on the page.
 * This creates a DataTransfer with the file and dispatches drag events to the window.
 */
const dropFile = async (page: Page, filePath: string, fileName: string) => {
	const fileBuffer = fs.readFileSync(filePath)
	const fileData = fileBuffer.toString('base64')

	await page.evaluate(
		async ({ fileData, fileName }) => {
			// Convert base64 back to ArrayBuffer
			const binaryString = atob(fileData)
			const bytes = new Uint8Array(binaryString.length)
			for (let i = 0; i < binaryString.length; i++) {
				bytes[i] = binaryString.charCodeAt(i)
			}

			// Create a File object
			const file = new File([bytes], fileName, { type: 'application/octet-stream' })

			// Create DataTransfer and add the file
			const dataTransfer = new DataTransfer()
			dataTransfer.items.add(file)

			// Dispatch dragenter to show the overlay
			const dragEnterEvent = new DragEvent('dragenter', {
				bubbles: true,
				cancelable: true,
				dataTransfer,
			})
			window.dispatchEvent(dragEnterEvent)

			// Small delay to let the UI update
			await new Promise((resolve) => setTimeout(resolve, 100))

			// Find the drop zone and dispatch drop event
			const dropZone = document.querySelector('[aria-label="File drop zone"]')
			if (!dropZone) {
				throw new Error('Drop zone not found')
			}

			const dropEvent = new DragEvent('drop', {
				bubbles: true,
				cancelable: true,
				dataTransfer,
			})
			dropZone.dispatchEvent(dropEvent)
		},
		{ fileData, fileName }
	)
}

test.describe('file drop', () => {
	test('drops PCD file and renders point cloud', async ({ browser }) => {
		const testPrefix = 'FILE_DROP_PCD'
		const failedScreenshots = [] as string[]
		const page = await createPage(browser)

		// Drop a simple PCD file
		const pcdPath = path.resolve(__dirname, '../client/data/simple.pcd')
		await dropFile(page, pcdPath, 'simple.pcd')

		// Wait for the file to be processed (FileReader is async)
		// The point cloud should appear in the tree
		await expect(page.getByText('simple.pcd', { exact: true })).toBeVisible({ timeout: 10000 })

		// Verify success toast appears
		await expect(page.getByText('Loaded simple.pcd')).toBeVisible({ timeout: 5000 })

		await takeScreenshot(page, testPrefix, failedScreenshots)

		assertNoFailedScreenshots(failedScreenshots)
	})

	test('drops PLY file and renders mesh', async ({ browser }) => {
		const testPrefix = 'FILE_DROP_PLY'
		const failedScreenshots = [] as string[]
		const page = await createPage(browser)

		// Drop a PLY file
		const plyPath = path.resolve(__dirname, '../client/data/lod_100.ply')
		await dropFile(page, plyPath, 'lod_100.ply')

		// Wait for the file to be processed
		await expect(page.getByText('lod_100.ply', { exact: true })).toBeVisible({ timeout: 10000 })

		// Verify success toast appears
		await expect(page.getByText('Loaded lod_100.ply')).toBeVisible({ timeout: 5000 })

		await takeScreenshot(page, testPrefix, failedScreenshots)

		assertNoFailedScreenshots(failedScreenshots)
	})

	test('shows error toast for unsupported file type', async ({ browser }) => {
		const testPrefix = 'FILE_DROP_UNSUPPORTED'
		const failedScreenshots = [] as string[]
		const page = await createPage(browser)

		// Create a temporary unsupported file in memory and drop it
		await page.evaluate(async () => {
			const file = new File(['some content'], 'document.txt', { type: 'text/plain' })
			const dataTransfer = new DataTransfer()
			dataTransfer.items.add(file)

			// Dispatch dragenter
			window.dispatchEvent(
				new DragEvent('dragenter', {
					bubbles: true,
					cancelable: true,
					dataTransfer,
				})
			)

			await new Promise((resolve) => setTimeout(resolve, 100))

			// Find the drop zone and dispatch drop event
			const dropZone = document.querySelector('[aria-label="File drop zone"]')
			if (!dropZone) {
				throw new Error('Drop zone not found')
			}

			dropZone.dispatchEvent(
				new DragEvent('drop', {
					bubbles: true,
					cancelable: true,
					dataTransfer,
				})
			)
		})

		// Verify error toast appears
		await expect(page.getByText(/files are supported/)).toBeVisible({ timeout: 5000 })

		await takeScreenshot(page, testPrefix, failedScreenshots)

		assertNoFailedScreenshots(failedScreenshots)
	})

	test('shows drag overlay when hovering with file', async ({ browser }) => {
		const testPrefix = 'FILE_DROP_OVERLAY'
		const failedScreenshots = [] as string[]
		const page = await createPage(browser)

		// Simulate dragenter to show the overlay
		await page.evaluate(async () => {
			const file = new File([''], 'test.pcd', { type: 'application/octet-stream' })
			const dataTransfer = new DataTransfer()
			dataTransfer.items.add(file)

			window.dispatchEvent(
				new DragEvent('dragenter', {
					bubbles: true,
					cancelable: true,
					dataTransfer,
				})
			)
		})

		// Verify the drop zone overlay becomes visible (not pointer-events-none)
		const dropZone = page.getByRole('region', { name: 'File drop zone' })
		await expect(dropZone).toBeVisible()

		// The overlay should have the bg-black/10 class when hovering
		await expect(dropZone).toHaveClass(/bg-black/)

		await takeScreenshot(page, testPrefix, failedScreenshots)

		assertNoFailedScreenshots(failedScreenshots)
	})
})
