import { expect, test } from '@playwright/test'
import path from 'node:path'
import url from 'node:url'

import { dropFileOnPage } from './helpers/dropFile'

const dirname = path.dirname(url.fileURLToPath(import.meta.url))

/**
 * Checks that the deployed playground is actually alive, which the rest of the
 * suite no longer covers now that it runs against a local production build.
 *
 * Deliberately has no screenshots. The deploy differs from a local build by
 * `BASE_PATH` and Sentry, so it cannot share baselines, and maintaining a
 * second set to prove the page loads would cost more than it catches.
 */
test.describe('playground deploy', () => {
	test('loads and accepts a dropped point cloud', async ({ page }) => {
		await page.goto('')

		const canvas = page.locator('canvas')
		await expect(canvas.first()).toBeVisible({ timeout: 30_000 })

		await dropFileOnPage(page, path.resolve(dirname, '../client/data/simple.pcd'))

		await expect(page.getByText('simple.pcd loaded.')).toBeVisible({ timeout: 30_000 })
		await expect(page.getByText('simple.pcd', { exact: true })).toBeVisible()
	})
})
