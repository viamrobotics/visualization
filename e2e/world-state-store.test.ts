import { expect, type Page } from '@playwright/test'
import { type JsonValue, Struct } from '@viamrobotics/sdk'
import { execSync } from 'node:child_process'
import path from 'node:path'
import url from 'node:url'

import { connectViamClient, getE2EConfig, withRobot } from './fixtures/with-robot'
import { waitForCanvasToChange, waitForCanvasToSettle } from './helpers/screenshot'
import { type ExpectedEntityState, readEntityState } from './matrix/entityState'

const dirname = path.dirname(url.fileURLToPath(import.meta.url))
const wsDir = path.resolve(dirname, 'fixtures/world-state-store')

const runGoTest = (testPath: string) => {
	const { host, apiKeyId, apiKey } = getE2EConfig()
	try {
		const output = execSync(`go test -run ${testPath} . -count=1 -v -timeout=60s 2>&1`, {
			encoding: 'utf8',
			cwd: wsDir,
			env: {
				...process.env,
				VIAM_E2E_HOST: host,
				VIAM_E2E_API_KEY_ID: apiKeyId,
				VIAM_E2E_API_KEY: apiKey,
			},
		})
		console.log(output)
	} catch (error: unknown) {
		const execError = error as { stdout?: string; stderr?: string; message?: string }
		console.error('Go test failed:', execError.stdout ?? '', execError.stderr ?? '')
		throw error
	}
}

const expectEntityState = (page: Page, name: string, expected: ExpectedEntityState) =>
	expect.poll(() => readEntityState(page, name), { timeout: 10_000 }).toMatchObject(expected)

/** The third column of a local matrix: where the entity's z axis points in its parent frame. */
const readLocalZAxis = async (page: Page, name: string) => {
	const { localMatrix } = await readEntityState(page, name)
	return localMatrix?.slice(8, 11)
}

/**
 * Runs a Go step and waits for what it changed to finish rendering.
 *
 * The canvas has to change before it is allowed to settle, because the scene
 * before the step is settled too and would pass for the result.
 *
 * @throws if the step leaves the canvas unchanged.
 */
const applyAndSettle = async (page: Page, testPath: string) => {
	const before = await waitForCanvasToSettle(page)
	runGoTest(testPath)
	const changed = await waitForCanvasToChange(page, before)
	if (changed === null) {
		throw new Error(`${testPath} never changed the canvas.`)
	}
	await waitForCanvasToSettle(page)
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

	const name = 'dynamic-sphere'

	runGoTest('^TestTransformUpdate$/AddTransform')
	await expect(page.getByText(name, { exact: true })).toBeVisible({ timeout: 10000 })
	await expectEntityState(page, name, { present: true, worldPosition: [0, 0, 0.3] })

	runGoTest('^TestTransformUpdate$/MoveTransform')
	await expectEntityState(page, name, { worldPosition: [-0.3, 0, 0.3] })

	// Orientation vector (1, 0, 0) points the entity's z axis along the parent's x axis.
	runGoTest('^TestTransformUpdate$/RotateTransform')
	await expect.poll(() => readLocalZAxis(page, name)).toEqual([1, 0, 0])
	await expectEntityState(page, name, { worldPosition: [-0.3, 0, 0.3] })

	// rgb(30, 144, 255) over 255.
	runGoTest('^TestTransformUpdate$/UpdateColor')
	await expectEntityState(page, name, { color: { r: 0.117647, g: 0.564706, b: 1 } })

	// An alpha of 96 over 255.
	runGoTest('^TestTransformUpdate$/UpdateOpacity')
	await expectEntityState(page, name, { opacity: 0.376471 })

	runGoTest('^TestTransformUpdate$/ToggleAxesHelper')
	await expectEntityState(page, name, { axesHelper: false })

	runGoTest('^TestTransformUpdate$/ToggleInvisibility')
	await expectEntityState(page, name, { invisible: true })

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
	await expectEntityState(page, 'removable-sphere', { present: true })

	runGoTest('^TestTransformRemoval$/RemoveTransform')
	await expect(page.getByText('removable-sphere', { exact: true })).toBeHidden({
		timeout: 10000,
	})
	await expectEntityState(page, 'removable-sphere', { present: false })
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
