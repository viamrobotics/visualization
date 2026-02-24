import { expect, test } from '@playwright/test'
import { execSync } from 'child_process'
import * as path from 'path'
import { fileURLToPath } from 'url'
import { createPage } from './page'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const snapshotsDir = path.resolve(__dirname, '../draw/__snapshots__')

const snapshots = [
	{ name: 'box', file: 'visualization_snapshot_box' },
	{ name: 'sphere', file: 'visualization_snapshot_sphere' },
	{ name: 'capsule', file: 'visualization_snapshot_capsule' },
	{ name: 'arrows', file: 'visualization_snapshot_arrows' },
	{ name: 'line', file: 'visualization_snapshot_line' },
	{ name: 'points', file: 'visualization_snapshot_points' },
	{ name: 'model', file: 'visualization_snapshot_model' },
]

const extensions = ['.json', '.pb', '.pb.gz']

test.beforeAll(() => {
	execSync(
		'go test -run ^TestGeneratingSnapshots$ github.com/viam-labs/motion-tools/draw -count=1',
		{ encoding: 'utf-8' }
	)
})

for (const snapshot of snapshots) {
	test.describe(`snapshot ${snapshot.name}`, () => {
		for (const ext of extensions) {
			const filename = `${snapshot.file}${ext}`
			const extLabel = ext.replace(/\./g, '_').replace(/^_/, '').toUpperCase()

			test(`drops ${ext} file`, async ({ browser }) => {
				const { page, dropFile, takeScreenshot, assertScreenshots } = await createPage(browser)

				await dropFile(path.resolve(snapshotsDir, filename))
				await expect(page.getByText(`${filename} loaded.`)).toBeVisible({
					timeout: 10000,
				})

				await takeScreenshot(`SNAPSHOT_DROP_${snapshot.name.toUpperCase()}_${extLabel}`)
				assertScreenshots()
			})
		}
	})
}
