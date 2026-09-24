import { execSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { expect, test } from './fixtures/drawing'
import { screenshotCanvas } from './helpers/screenshot'

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
		waitFor: ['duck', 'milktruck'],
	},
]

test.beforeAll(() => {
	execSync(
		'go test -run ^TestGeneratingSnapshots$ github.com/viamrobotics/visualization/draw -count=1',
		{ encoding: 'utf8' }
	)
})

for (const snapshot of snapshots) {
	test(`drops ${snapshot.file}`, async ({ page, dropFile }) => {
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

		await screenshotCanvas(page, `SNAPSHOT_DROP_${snapshot.name.toUpperCase()}_PB_GZ`)
	})
}

test('drops visualization_snapshot_metadata', async ({ page, dropFile, takeScreenshot }) => {
	const filename = 'visualization_snapshot_metadata.pb.gz'

	await dropFile(path.resolve(snapshotsDir, filename))
	await expect(page.getByText(`${filename} loaded.`)).toBeVisible({ timeout: 10000 })
	await page.getByRole('button', { name: 'Dismiss toast' }).click()
	await expect(page.getByText(`${filename} loaded.`)).not.toBeVisible()

	await page.getByText('relationship-arrows', { exact: true }).first().click()

	await expect(page.getByText('Relationships')).toBeVisible()
	await expect(page.getByText('relationship-capsule (HoverLink)')).toBeVisible()

	await takeScreenshot('SNAPSHOT_METADATA_RELATIONSHIP_DETAILS')
})

test('updates snapshots with the same UUID', async ({ page, gotoScene }) => {
	await gotoScene('snapshot/reconcile')

	const loadV1 = page.getByRole('button', { name: 'Load v1' })
	const loadV2 = page.getByRole('button', { name: 'Load v2' })
	const loadV3 = page.getByRole('button', { name: 'Load v3' })
	const loadNew = page.getByRole('button', { name: 'Load new' })

	await expect(loadV1).toBeVisible({ timeout: 15000 })

	await loadV1.click()
	await expect(page.getByText('reconcile-static', { exact: true }).first()).toBeVisible({
		timeout: 10000,
	})
	await expect(page.getByText('reconcile-moving', { exact: true }).first()).toBeVisible()
	await expect(page.getByText('reconcile-removed', { exact: true }).first()).toBeVisible()
	await screenshotCanvas(page, 'SNAPSHOT_RECONCILE_V1')

	await loadV2.click()
	await expect(page.getByText('reconcile-removed', { exact: true })).toHaveCount(0, {
		timeout: 10000,
	})
	await expect(page.getByText('reconcile-added', { exact: true }).first()).toBeVisible()
	await expect(page.getByText('reconcile-static', { exact: true }).first()).toBeVisible()
	await expect(page.getByText('reconcile-moving', { exact: true }).first()).toBeVisible()
	await screenshotCanvas(page, 'SNAPSHOT_RECONCILE_V2')

	await loadV3.click()
	await expect(page.getByText('reconcile-moving', { exact: true })).toHaveCount(0, {
		timeout: 10000,
	})
	await expect(page.getByText('reconcile-static', { exact: true }).first()).toBeVisible()
	await expect(page.getByText('reconcile-added', { exact: true }).first()).toBeVisible()
	await screenshotCanvas(page, 'SNAPSHOT_RECONCILE_V3')

	// A snapshot with a different snapshot.uuid should wipe all prior entities
	await loadNew.click()
	await expect(page.getByText('wiped-cube-left', { exact: true }).first()).toBeVisible({
		timeout: 10000,
	})
	await expect(page.getByText('wiped-cube-center', { exact: true }).first()).toBeVisible()
	await expect(page.getByText('wiped-cube-right', { exact: true }).first()).toBeVisible()
	await expect(page.getByText('reconcile-static', { exact: true })).toHaveCount(0)
	await expect(page.getByText('reconcile-added', { exact: true })).toHaveCount(0)
	await screenshotCanvas(page, 'SNAPSHOT_RECONCILE_NEW')
})
