import path from 'node:path'
import url from 'node:url'

import { expect, test } from './fixtures/drawing'
import { screenshotCanvas } from './helpers/screenshot'

const __filename = url.fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

test.describe('file drop', () => {
	test('drops PCD file and renders point cloud', async ({ page, dropFile }) => {
		await dropFile(path.resolve(__dirname, '../client/data/simple.pcd'))

		await expect(page.getByText('simple.pcd', { exact: true })).toBeVisible({ timeout: 10000 })
		await expect(page.getByText('simple.pcd loaded.')).toBeVisible({ timeout: 5000 })

		await screenshotCanvas(page, 'FILE_DROP_PCD')
	})

	test('drops PLY file and renders mesh', async ({ page, dropFile }) => {
		await dropFile(path.resolve(__dirname, '../client/data/lod_100.ply'))

		await expect(page.getByText('lod_100.ply', { exact: true })).toBeVisible({ timeout: 10000 })
		await expect(page.getByText('lod_100.ply loaded.')).toBeVisible({ timeout: 5000 })

		await screenshotCanvas(page, 'FILE_DROP_PLY')
	})

	test('shows error toast for unsupported file type', async ({
		page,
		dropFile,
		takeScreenshot,
	}) => {
		await dropFile({ name: 'document.txt', content: 'some content' })

		await expect(page.getByText(/files are supported/)).toBeVisible({ timeout: 5000 })

		await takeScreenshot('FILE_DROP_UNSUPPORTED')
	})
})
