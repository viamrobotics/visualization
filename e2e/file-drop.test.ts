import { expect, test } from '@playwright/test'
import path from 'node:path'
import url from 'node:url'

import { createPage } from './page'

const __filename = url.fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

test.describe('file drop', () => {
	test('drops PCD file and renders point cloud', async ({ browser }) => {
		const { page, dropFile, takeScreenshot, assertScreenshots } = await createPage(browser)

		await dropFile(path.resolve(__dirname, '../client/data/simple.pcd'))

		await expect(page.getByText('simple.pcd', { exact: true })).toBeVisible({ timeout: 10000 })
		await expect(page.getByText('simple.pcd loaded.')).toBeVisible({ timeout: 5000 })

		await takeScreenshot('FILE_DROP_PCD')
		assertScreenshots()
	})

	test('drops PLY file and renders mesh', async ({ browser }) => {
		const { page, dropFile, takeScreenshot, assertScreenshots } = await createPage(browser)

		await dropFile(path.resolve(__dirname, '../client/data/lod_100.ply'))

		await expect(page.getByText('lod_100.ply', { exact: true })).toBeVisible({ timeout: 10000 })
		await expect(page.getByText('lod_100.ply loaded.')).toBeVisible({ timeout: 5000 })

		await takeScreenshot('FILE_DROP_PLY')
		assertScreenshots()
	})

	test('shows error toast for unsupported file type', async ({ browser }) => {
		const { page, dropFile, takeScreenshot, assertScreenshots } = await createPage(browser)

		await dropFile({ name: 'document.txt', content: 'some content' })

		await expect(page.getByText(/files are supported/)).toBeVisible({ timeout: 5000 })

		await takeScreenshot('FILE_DROP_UNSUPPORTED')
		assertScreenshots()
	})
})
