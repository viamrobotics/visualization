import { expect, type Page } from '@playwright/test'
import { type JsonValue, Struct } from '@viamrobotics/sdk'
import { execSync } from 'node:child_process'
import path from 'node:path'
import url from 'node:url'

import { connectViamClient, getE2EConfig, withRobot } from './fixtures/with-robot'
import { readRenderFrame, waitForRenderIdle } from './helpers/renderIdle'

const dirname = path.dirname(url.fileURLToPath(import.meta.url))
const wsDir = path.resolve(dirname, 'fixtures/world-state-store')

const runGoTest = (testPath: string) => {
	try {
		const output = execSync(`go test -run ${testPath} . -count=1 -v -timeout=60s 2>&1`, {
			encoding: 'utf8',
			cwd: wsDir,
		})
		console.log(output)
	} catch (error: unknown) {
		const execError = error as { stdout?: string; stderr?: string; message?: string }
		console.error('Go test failed:', execError.stdout ?? '', execError.stderr ?? '')
		throw error
	}
}

/**
 * Runs a Go step and waits for what it changed to finish rendering.
 *
 * The frame count is read before the step because `waitForRenderIdle` would
 * otherwise see a scene that has not reacted yet and call it settled.
 */
const applyAndSettle = async (page: Page, testPath: string) => {
	const before = await readRenderFrame(page)
	runGoTest(testPath)
	await waitForRenderIdle(page, { after: before })
}

const getWorldStateConfig = () => {
	const moduleBinPath = path.resolve(dirname, '.bin/world-state-store')

	return {
		modules: [
			{
				type: 'local',
				name: 'e2e-world-state-store',
				executable_path: moduleBinPath,
			},
		],
		services: [
			{
				name: 'world-state-store',
				api: 'rdk:service:world_state_store',
				model: 'e2e:test:world-state-store',
				attributes: {},
			},
		],
		components: [],
	}
}

withRobot.beforeAll(async () => {
	const config = getE2EConfig()
	const viamClient = await connectViamClient()
	await viamClient.appClient.updateRobotPart(
		config.partId,
		config.machineName,
		Struct.fromJson(getWorldStateConfig() as unknown as JsonValue)
	)

	// Elapsed time, and it is load-bearing. The browser subscribes once on
	// connect, so a service that appears after the page loads never reaches it,
	// and dropping this made the first test in this file fail outright. It cannot
	// become a poll: the machine is only reachable over WebRTC from a browser, and
	// `createRobotClient` hangs when called from the test process.
	// Give viam-server time to load the module and configure the service.
	await new Promise((resolve) => setTimeout(resolve, 10000))
})

withRobot('world state store geometry rendering', async ({ robotPage }) => {
	const { page } = robotPage

	await expect(page.getByText('test-box', { exact: true })).toBeVisible({ timeout: 30000 })
	await expect(page.getByText('test-sphere', { exact: true })).toBeVisible()
	await expect(page.getByText('test-capsule', { exact: true })).toBeVisible()
	await expect(page.getByText('test-pointcloud', { exact: true })).toBeVisible()
	await expect(page.getByText('test-mesh', { exact: true })).toBeVisible()
	await expect(page.getByText('test-axes-helper', { exact: true })).toBeVisible()

	await robotPage.screenshotCanvas('WORLD-STATE-0-transforms-loaded')

	await page.getByText('test-box', { exact: true }).click()
	await expect(page.getByRole('region', { name: 'Details panel' })).toBeVisible()
	await robotPage.screenshotCanvas('WORLD-STATE-1-box-selected')

	await page.getByText('test-sphere', { exact: true }).click()
	await expect(page.getByRole('region', { name: 'Details panel' })).toBeVisible()
	await robotPage.screenshotCanvas('WORLD-STATE-2-sphere-selected')

	await page.getByText('test-capsule', { exact: true }).click()
	await expect(page.getByRole('region', { name: 'Details panel' })).toBeVisible()
	await robotPage.screenshotCanvas('WORLD-STATE-3-capsule-selected')

	await page.getByText('test-pointcloud', { exact: true }).click()
	await expect(page.getByRole('region', { name: 'Details panel' })).toBeVisible()
	await robotPage.screenshotCanvas('WORLD-STATE-4-pointcloud-selected')

	await page.getByText('test-mesh', { exact: true }).click()
	await expect(page.getByRole('region', { name: 'Details panel' })).toBeVisible()
	await robotPage.screenshotCanvas('WORLD-STATE-5-mesh-selected')
})

withRobot('world state store transform update', async ({ robotPage }) => {
	const { page } = robotPage

	await expect(page.getByText('test-box', { exact: true })).toBeVisible({ timeout: 30000 })

	runGoTest('^TestTransformUpdate$/AddTransform')
	await expect(page.getByText('dynamic-sphere', { exact: true })).toBeVisible({ timeout: 10000 })
	await robotPage.screenshotCanvas('WORLD-STATE-UPDATE-0-added')

	await applyAndSettle(page, '^TestTransformUpdate$/MoveTransform')
	await robotPage.screenshotCanvas('WORLD-STATE-UPDATE-1-moved')

	await applyAndSettle(page, '^TestTransformUpdate$/RotateTransform')
	await robotPage.screenshotCanvas('WORLD-STATE-UPDATE-2-rotated')

	await applyAndSettle(page, '^TestTransformUpdate$/UpdateColor')
	await robotPage.screenshotCanvas('WORLD-STATE-UPDATE-3-colored')

	await applyAndSettle(page, '^TestTransformUpdate$/UpdateOpacity')
	await robotPage.screenshotCanvas('WORLD-STATE-UPDATE-4-translucent')

	await applyAndSettle(page, '^TestTransformUpdate$/ToggleAxesHelper')
	await robotPage.screenshotCanvas('WORLD-STATE-UPDATE-5-axes-hidden')

	await applyAndSettle(page, '^TestTransformUpdate$/ToggleInvisibility')
	await robotPage.screenshotCanvas('WORLD-STATE-UPDATE-6-invisible')

	runGoTest('^TestTransformUpdate$/Cleanup')
	await expect(page.getByText('dynamic-sphere', { exact: true })).toBeHidden({ timeout: 10000 })
})

withRobot('world state store transform removal', async ({ robotPage }) => {
	const { page } = robotPage

	await expect(page.getByText('test-box', { exact: true })).toBeVisible({ timeout: 30000 })

	runGoTest('^TestTransformRemoval$/AddTransform')
	await expect(page.getByText('removable-sphere', { exact: true })).toBeVisible({
		timeout: 10000,
	})
	await robotPage.screenshotCanvas('WORLD-STATE-REMOVE-0-added')

	runGoTest('^TestTransformRemoval$/RemoveTransform')
	await expect(page.getByText('removable-sphere', { exact: true })).toBeHidden({
		timeout: 10000,
	})
	await robotPage.screenshotCanvas('WORLD-STATE-REMOVE-1-removed')
})

withRobot('world state store point cloud update', async ({ robotPage }) => {
	const { page } = robotPage

	await expect(page.getByText('test-box', { exact: true })).toBeVisible({ timeout: 30000 })

	runGoTest('^TestPointCloudUpdate$/AddPointCloud')
	await expect(page.getByText('updating-pointcloud', { exact: true })).toBeVisible({
		timeout: 10000,
	})

	await robotPage.screenshotCanvas('WORLD-STATE-POINTCLOUD-UPDATE-0-initial')

	await applyAndSettle(page, '^TestPointCloudUpdate$/UpdatePointCloud')
	await robotPage.screenshotCanvas('WORLD-STATE-POINTCLOUD-UPDATE-1-updated')

	// Cleanup removes the entity AND resets the camera.
	runGoTest('^TestPointCloudUpdate$/Cleanup')
	await expect(page.getByText('updating-pointcloud', { exact: true })).toBeHidden({
		timeout: 10000,
	})
})

withRobot('world state store point cloud chunking', async ({ robotPage }) => {
	const { page } = robotPage

	await expect(page.getByText('test-box', { exact: true })).toBeVisible({ timeout: 30000 })

	runGoTest('^TestPointCloudChunking$/AddChunkedPointCloud')

	await expect(page.getByText('chunked-cloud', { exact: true })).toBeVisible({ timeout: 10000 })

	const progressBar = page.getByRole('progressbar')
	await expect(progressBar).toBeHidden({ timeout: 30000 })
	await robotPage.screenshotCanvas('WORLD-STATE-CHUNK-0-loaded')

	runGoTest('^TestPointCloudChunking$/Cleanup')
	await expect(page.getByText('chunked-cloud', { exact: true })).toBeHidden({ timeout: 10000 })
})

withRobot.afterAll(async () => {
	const config = getE2EConfig()
	const viamClient = await connectViamClient()
	await viamClient.appClient.updateRobotPart(config.partId, config.machineName, Struct.fromJson({}))
})
