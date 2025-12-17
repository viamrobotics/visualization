import {
	createViamClient,
	JsonValue,
	Struct,
	ViamClient,
	ViamClientOptions,
} from '@viamrobotics/sdk'
import { expect, test } from '@playwright/test'
import { execSync } from 'child_process'

const testConfig = {
	host: 'motion-tools-e2e-main.l6j4r7m65g.viam.cloud',
	name: 'motion-tools-e2e-main',
	partId: '9741704d-ea0e-484c-8cf8-0a849096af1e',
	apiKeyId: '5450f99a-c7f9-4677-aa1d-8f2e77707a39',
	apiKeyValue: 'ag5vx3ginkwvubcp1w18gfue099i9zoz',
	signalingAddress: 'https://app.viam.com:443',
	organizationId: 'd9fd430a-25ec-47ba-b548-5d1b1b2fc6d1',
}

async function connectViamClient(): Promise<ViamClient> {
	const API_KEY_ID = testConfig.apiKeyId
	const API_KEY = testConfig.apiKeyValue
	const opts: ViamClientOptions = {
		serviceHost: testConfig.signalingAddress,
		credentials: {
			type: 'api-key',
			authEntity: API_KEY_ID,
			payload: API_KEY,
		},
	}

	const client = await createViamClient(opts)
	return client
}

let viamClient: ViamClient

test.beforeAll(async () => {
	viamClient = await connectViamClient()
})

const armConfig = {
	components: [
		{
			name: 'arm-1',
			api: 'rdk:component:arm',
			model: 'rdk:builtin:fake',
			attributes: {
				'arm-model': 'ur5e',
			},
			frame: {
				parent: 'world',
				translation: {
					x: 0,
					y: 0,
					z: 0,
				},
				orientation: {
					type: 'ov_degrees',
					value: {
						x: 0,
						y: 0,
						z: 1,
						th: 0,
					},
				},
			},
		},
		{
			name: 'generic-1',
			api: 'rdk:component:generic',
			model: 'rdk:builtin:fake',
			attributes: {},
			frame: {
				parent: 'arm-1',
				translation: {
					x: 0,
					y: 0,
					z: 100,
				},
				orientation: {
					type: 'ov_degrees',
					value: {
						x: 0,
						y: 0,
						z: 1,
						th: 0,
					},
				},
				geometry: {
					type: 'sphere',
					r: 100,
				},
			},
		},
	],
}

test('arm', async ({ browser }) => {
	const testPrefix = 'ARM'
	await viamClient.appClient.updateRobotPart(
		testConfig.partId,
		testConfig.name,
		Struct.fromJson(armConfig as unknown as JsonValue)
	)

	const failedScreenshots = [] as string[]
	const context = await browser.newContext()
	await context.addCookies([
		{
			name: 'weblab_experiments',
			value: 'MOTION_TOOLS_RENDER_ARM_MODELS',
			domain: 'localhost',
			path: '/',
		},
	])
	const page = await context.newPage()
	await page.waitForTimeout(5000)
	page.on('console', (message) => {
		console.log(`[${message.type()}] ${message.text()}`)
	})
	await page.goto('/')
	await expect(page.getByText('World', { exact: true })).toBeVisible()

	// SETUP CONFIG
	await expect(page.getByLabel('Machine connection configs')).toBeVisible()
	await page.getByLabel('Machine connection configs').click()

	await expect(page.getByText('Add config', { exact: true })).toBeVisible()
	await page.getByText('Add config', { exact: true }).click()

	await expect(page.getByPlaceholder(/host/iu)).toBeVisible()
	await page.getByPlaceholder(/host/iu).fill(testConfig.host)
	await expect(page.getByPlaceholder(/part id/iu)).toBeVisible()
	await page.getByPlaceholder(/part id/iu).fill(testConfig.partId)
	await expect(page.getByPlaceholder(/api key id/iu)).toBeVisible()
	await page.getByPlaceholder(/api key id/iu).fill(testConfig.apiKeyId)
	await expect(page.getByPlaceholder(/api key value/iu)).toBeVisible()
	await page.getByPlaceholder(/api key value/iu).fill(testConfig.apiKeyValue)
	await expect(page.getByPlaceholder(/signaling address/iu)).toBeVisible()
	await page.getByPlaceholder(/signaling address/iu).fill(testConfig.signalingAddress)

	await page.getByTestId('icon-close').click()

	await page.waitForSelector('[data-part="branch-indicator"]', { timeout: 5000 })

	await expect(page.getByText('arm-1', { exact: true })).toBeVisible()
	await page.getByText('arm-1', { exact: true }).click()

	await expect(page.getByTestId('details-header')).toBeVisible()

	try {
		await expect(page).toHaveScreenshot(`${testPrefix}-0-loaded.png`, {
			fullPage: true,
			threshold: 0.1,
		})
	} catch (error) {
		console.warn(error)
		failedScreenshots.push(`${testPrefix}-0-loaded.png`)
	}

	// MOVE ARM
	execSync('go run e2e/go-scripts/main.go moveArmJointPositions', {
		encoding: 'utf-8',
	})

	await page.waitForTimeout(1000) // wait for arm pose refetch
	try {
		await expect(page).toHaveScreenshot(`${testPrefix}-1-moved.png`, {
			fullPage: true,
			threshold: 0.1,
		})
	} catch (error) {
		console.warn(error)
		failedScreenshots.push(`${testPrefix}-1-moved.png`)
	}
})

test.afterAll('cleanup', async () => {
	await viamClient.appClient.updateRobotPart(
		testConfig.partId,
		testConfig.name,
		Struct.fromJson({})
	)
})
