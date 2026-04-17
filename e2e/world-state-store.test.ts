import { expect } from '@playwright/test'
import { type JsonValue, Struct } from '@viamrobotics/sdk'
import { execSync } from 'node:child_process'
import path from 'node:path'
import url from 'node:url'

import { connectViamClient, getE2EConfig, withRobot } from './fixtures/with-robot'

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

	// Give viam-server time to load the module and configure the service
	await new Promise((resolve) => setTimeout(resolve, 10000))
})

withRobot('world state store geometry rendering', async ({ robotPage }) => {
	const { page } = robotPage

	// Wait for the world state store entities to appear in the tree
	await expect(page.getByText('test-box', { exact: true })).toBeVisible({ timeout: 30000 })
	await expect(page.getByText('test-sphere', { exact: true })).toBeVisible()
	await expect(page.getByText('test-capsule', { exact: true })).toBeVisible()
	await expect(page.getByText('test-pointcloud', { exact: true })).toBeVisible()
	await expect(page.getByText('test-mesh', { exact: true })).toBeVisible()
	await expect(page.getByText('test-axes-helper', { exact: true })).toBeVisible()

	await robotPage.takeScreenshot('WORLD-STATE-0-transforms-loaded')

	await page.getByText('test-box', { exact: true }).click()
	await expect(page.getByTestId('details-header')).toBeVisible()
	await robotPage.takeScreenshot('WORLD-STATE-1-box-selected')

	await page.getByText('test-sphere', { exact: true }).click()
	await expect(page.getByTestId('details-header')).toBeVisible()
	await robotPage.takeScreenshot('WORLD-STATE-2-sphere-selected')

	await page.getByText('test-capsule', { exact: true }).click()
	await expect(page.getByTestId('details-header')).toBeVisible()
	await robotPage.takeScreenshot('WORLD-STATE-3-capsule-selected')

	await page.getByText('test-pointcloud', { exact: true }).click()
	await expect(page.getByTestId('details-header')).toBeVisible()
	await robotPage.takeScreenshot('WORLD-STATE-4-pointcloud-selected')

	await page.getByText('test-mesh', { exact: true }).click()
	await expect(page.getByTestId('details-header')).toBeVisible()
	await robotPage.takeScreenshot('WORLD-STATE-5-mesh-selected')

	robotPage.assertScreenshots()
})

withRobot('world state store transform update', async ({ robotPage }) => {
	const { page } = robotPage

	await expect(page.getByText('test-box', { exact: true })).toBeVisible({ timeout: 30000 })

	runGoTest('^TestTransformUpdate$/AddTransform')
	await expect(page.getByText('dynamic-sphere', { exact: true })).toBeVisible({ timeout: 10000 })
	await robotPage.takeScreenshot('WORLD-STATE-UPDATE-0-added')

	runGoTest('^TestTransformUpdate$/MoveTransform')
	await page.waitForTimeout(2000)
	await robotPage.takeScreenshot('WORLD-STATE-UPDATE-1-moved')

	runGoTest('^TestTransformUpdate$/RotateTransform')
	await page.waitForTimeout(2000)
	await robotPage.takeScreenshot('WORLD-STATE-UPDATE-2-rotated')

	runGoTest('^TestTransformUpdate$/UpdateColor')
	await page.waitForTimeout(2000)
	await robotPage.takeScreenshot('WORLD-STATE-UPDATE-3-colored')

	runGoTest('^TestTransformUpdate$/UpdateOpacity')
	await page.waitForTimeout(2000)
	await robotPage.takeScreenshot('WORLD-STATE-UPDATE-4-translucent')

	runGoTest('^TestTransformUpdate$/ToggleAxesHelper')
	await page.waitForTimeout(2000)
	await robotPage.takeScreenshot('WORLD-STATE-UPDATE-5-axes-hidden')

	runGoTest('^TestTransformUpdate$/ToggleInvisibility')
	await page.waitForTimeout(2000)
	await robotPage.takeScreenshot('WORLD-STATE-UPDATE-6-invisible')

	runGoTest('^TestTransformUpdate$/Cleanup')
	await expect(page.getByText('dynamic-sphere', { exact: true })).toBeHidden({ timeout: 10000 })

	robotPage.assertScreenshots()
})

withRobot('world state store transform removal', async ({ robotPage }) => {
	const { page } = robotPage

	await expect(page.getByText('test-box', { exact: true })).toBeVisible({ timeout: 30000 })

	runGoTest('^TestTransformRemoval$/AddTransform')
	await expect(page.getByText('removable-sphere', { exact: true })).toBeVisible({
		timeout: 10000,
	})
	await robotPage.takeScreenshot('WORLD-STATE-REMOVE-0-added')

	runGoTest('^TestTransformRemoval$/RemoveTransform')
	await expect(page.getByText('removable-sphere', { exact: true })).toBeHidden({
		timeout: 10000,
	})
	await robotPage.takeScreenshot('WORLD-STATE-REMOVE-1-removed')

	robotPage.assertScreenshots()
})

withRobot('world state store point cloud chunking', async ({ robotPage }) => {
	const { page } = robotPage

	await expect(page.getByText('test-box', { exact: true })).toBeVisible({ timeout: 30000 })

	runGoTest('^TestPointCloudChunking$/AddChunkedPointCloud')

	await expect(page.getByText('chunked-cloud', { exact: true })).toBeVisible({ timeout: 10000 })

	const progressBar = page.getByRole('progressbar')
	await expect(progressBar).toBeVisible()
	await expect(progressBar).toBeHidden({ timeout: 30000 })
	await robotPage.takeScreenshot('WORLD-STATE-CHUNK-0-loaded')

	runGoTest('^TestPointCloudChunking$/Cleanup')
	await expect(page.getByText('chunked-cloud', { exact: true })).toBeHidden({ timeout: 10000 })

	robotPage.assertScreenshots()
})

withRobot.afterAll(async () => {
	const config = getE2EConfig()
	const viamClient = await connectViamClient()
	await viamClient.appClient.updateRobotPart(config.partId, config.machineName, Struct.fromJson({}))
})
