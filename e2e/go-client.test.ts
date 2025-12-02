import { expect, test } from '@playwright/test'
import { execSync } from 'child_process'
import { createPage } from './helpers/create-page'
import { assertNoFailedScreenshots, takeScreenshot } from './helpers/take-screenshot'

test('draw frame system', async ({ browser }) => {
	const { page, failedScreenshots } = await createPage(browser)

	execSync(
		'go test -run ^TestDrawFrameSystem$/DrawFrameSystem github.com/viam-labs/motion-tools/client/client -count=1',
		{
			encoding: 'utf-8',
		}
	)

	await takeScreenshot(page, 'DRAW_FRAME_SYSTEM', failedScreenshots)

	assertNoFailedScreenshots(failedScreenshots)
})

test('draw frames', async ({ browser }) => {
	const { page, failedScreenshots } = await createPage(browser)

	execSync(
		'go test -run ^TestDrawFrames$/DrawFrames github.com/viam-labs/motion-tools/client/client -count=1',
		{
			encoding: 'utf-8',
		}
	)

	await takeScreenshot(page, 'DRAW_FRAMES', failedScreenshots)

	assertNoFailedScreenshots(failedScreenshots)
})

test('draw geometries', async ({ browser }) => {
	const { page, failedScreenshots } = await createPage(browser)

	execSync(
		'go test -run ^TestDrawGeometries$/DrawGeometries github.com/viam-labs/motion-tools/client/client -count=1',
		{
			encoding: 'utf-8',
		}
	)

	await takeScreenshot(page, 'DRAW_GEOMETRIES', failedScreenshots)

	assertNoFailedScreenshots(failedScreenshots)
})

test('draw geometries updating', async ({ browser }) => {
	const { page, failedScreenshots } = await createPage(browser)

	execSync(
		'go test -run ^TestDrawGeometriesUpdating$/DrawGeometriesUpdating github.com/viam-labs/motion-tools/client/client -count=1',
		{
			encoding: 'utf-8',
		}
	)

	await takeScreenshot(page, 'DRAW_GEOMETRIES_UPDATING', failedScreenshots)

	assertNoFailedScreenshots(failedScreenshots)
})

test('draw gltf', async ({ browser }) => {
	const { page, failedScreenshots } = await createPage(browser)

	execSync(
		'go test -run ^TestDrawGLTF$/DrawGLTF github.com/viam-labs/motion-tools/client/client -count=1',
		{
			encoding: 'utf-8',
		}
	)

	await expect(page.locator('[role="tree"]').getByText(/Scene|model/)).toBeVisible({
		timeout: 30000,
	})

	await takeScreenshot(page, 'DRAW_GLTF', failedScreenshots)

	assertNoFailedScreenshots(failedScreenshots)
})

test('draw lines', async ({ browser }) => {
	const { page, failedScreenshots } = await createPage(browser)

	execSync(
		'go test -run ^TestDrawLines$/DrawLine github.com/viam-labs/motion-tools/client/client -count=1',
		{
			encoding: 'utf-8',
		}
	)

	await takeScreenshot(page, 'DRAW_LINES', failedScreenshots)

	assertNoFailedScreenshots(failedScreenshots)
})

test('draw point cloud', async ({ browser }) => {
	const { page, failedScreenshots } = await createPage(browser)

	execSync(
		'go test -run ^TestDrawPointCloud$/DrawPointCloud github.com/viam-labs/motion-tools/client/client -count=1',
		{
			encoding: 'utf-8',
		}
	)

	await expect(page.getByText('Zaghetto', { exact: true })).toBeVisible({ timeout: 15000 })
	await expect(page.getByText('Zaghetto1', { exact: true })).toBeVisible({ timeout: 15000 })
	await expect(page.getByText('Zaghetto2', { exact: true })).toBeVisible({ timeout: 15000 })
	await expect(page.getByText('Zaghetto3', { exact: true })).toBeVisible({ timeout: 15000 })
	await expect(page.getByText('Zaghetto4', { exact: true })).toBeVisible({ timeout: 15000 })

	await takeScreenshot(page, 'DRAW_POINT_CLOUD', failedScreenshots)

	assertNoFailedScreenshots(failedScreenshots)
})

test('draw points', async ({ browser }) => {
	const { page, failedScreenshots } = await createPage(browser)

	execSync(
		'go test -run ^TestDrawPoints$/DrawPoints github.com/viam-labs/motion-tools/client/client -count=1',
		{
			encoding: 'utf-8',
		}
	)

	await takeScreenshot(page, 'DRAW_POINTS', failedScreenshots)

	assertNoFailedScreenshots(failedScreenshots)
})

test('draw poses', async ({ browser }) => {
	const { page, failedScreenshots } = await createPage(browser)

	execSync(
		'go test -run ^TestDrawPoses$/DrawPoses github.com/viam-labs/motion-tools/client/client -count=1',
		{
			encoding: 'utf-8',
		}
	)

	await takeScreenshot(page, 'DRAW_POSES', failedScreenshots)

	assertNoFailedScreenshots(failedScreenshots)
})

test('draw world state', async ({ browser }) => {
	const { page, failedScreenshots } = await createPage(browser)

	execSync(
		'go test -run ^TestDrawWorldState$/DrawWorldState github.com/viam-labs/motion-tools/client/client -count=1',
		{
			encoding: 'utf-8',
		}
	)
	await takeScreenshot(page, 'DRAW_WORLD_STATE', failedScreenshots)

	assertNoFailedScreenshots(failedScreenshots)
})

test('remove spatial objects', async ({ browser }) => {
	const { page, failedScreenshots } = await createPage(browser)

	execSync(
		'go test -run ^TestRemoveSpatialObjects$/RemoveSpatialObjects github.com/viam-labs/motion-tools/client/client -count=1',
		{
			encoding: 'utf-8',
		}
	)
	await takeScreenshot(page, 'REMOVE_SPATIAL_OBJECTS', failedScreenshots)

	assertNoFailedScreenshots(failedScreenshots)
})

test('set camera pose', async ({ browser }) => {
	const { page, failedScreenshots } = await createPage(browser)

	execSync(
		'go test -run ^TestSetCameraPose$/SetCameraPose github.com/viam-labs/motion-tools/client/client -count=1',
		{
			encoding: 'utf-8',
		}
	)

	// Camera animations are client-side and can't be detected via DOM
	// Wait for a reasonable duration for the animation to complete (typical animations are 500-1000ms)
	await page.waitForTimeout(3000)

	await takeScreenshot(page, 'SET_CAMERA_POSE', failedScreenshots)

	assertNoFailedScreenshots(failedScreenshots)
})
