import { expect, test } from '@playwright/test'
import { execSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { createPage } from './page'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const snapshotsDir = path.resolve(__dirname, '../draw/__snapshots__')

const snapshots: Array<{ name: string; file: string; waitFor?: string[] }> = [
	{ name: 'box', file: 'visualization_snapshot_box' },
	{ name: 'sphere', file: 'visualization_snapshot_sphere' },
	{ name: 'capsule', file: 'visualization_snapshot_capsule' },
	{ name: 'arrows', file: 'visualization_snapshot_arrows' },
	{ name: 'line', file: 'visualization_snapshot_line' },
	{ name: 'points', file: 'visualization_snapshot_points' },
	{
		name: 'model',
		file: 'visualization_snapshot_model',
		waitFor: ['duck', 'avocado', 'lantern', 'box', 'milktruck', 'fox'],
	},
]

test.beforeAll(() => {
	execSync(
		'go test -run ^TestGeneratingSnapshots$ github.com/viam-labs/motion-tools/draw -count=1',
		{ encoding: 'utf8' }
	)
})

for (const snapshot of snapshots) {
	test(`drops ${snapshot.file}`, async ({ browser }) => {
		const { page, dropFile, takeScreenshot, assertScreenshots } = await createPage(browser)

		await dropFile(path.resolve(snapshotsDir, `${snapshot.file}.pb.gz`))
		await expect(page.getByText(`${snapshot.file}.pb.gz loaded.`)).toBeVisible({
			timeout: 10000,
		})

		const dismissButton = page.getByRole('button', { name: 'Dismiss toast' })
		await expect(dismissButton).toBeVisible({ timeout: 10000 })
		await dismissButton.click()

		await expect(page.getByText(`${snapshot.file}.pb.gz loaded.`)).not.toBeVisible()

		for (const label of snapshot.waitFor ?? []) {
			await expect(page.getByText(label, { exact: true }).first()).toBeVisible({
				timeout: 30000,
			})
		}

		await takeScreenshot(`SNAPSHOT_DROP_${snapshot.name.toUpperCase()}_PB_GZ`)
		assertScreenshots()
	})
}

test('drops visualization_snapshot_metadata', async ({ browser }) => {
	const { page, dropFile, takeScreenshot, assertScreenshots } = await createPage(browser)
	const filename = 'visualization_snapshot_metadata.pb.gz'

	await dropFile(path.resolve(snapshotsDir, filename))
	await expect(page.getByText(`${filename} loaded.`)).toBeVisible({ timeout: 10000 })
	await page.getByRole('button', { name: 'Dismiss toast' }).click()
	await expect(page.getByText(`${filename} loaded.`)).not.toBeVisible()

	// Select the arrows drawing that carries a HoverLink relationship to the capsule
	await page.getByText('relationship-arrows', { exact: true }).first().click()

	// The details panel should show the Relationships section with the linked entity
	await expect(page.getByText('Relationships')).toBeVisible()
	await expect(page.getByText('relationship-capsule (HoverLink)')).toBeVisible()

	await takeScreenshot('SNAPSHOT_METADATA_RELATIONSHIP_DETAILS')
	assertScreenshots()
})
