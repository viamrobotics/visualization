import { expect } from '@playwright/test'
import { execSync } from 'node:child_process'

import {
	applyMachineConfig,
	connectViamClient,
	getE2EConfig,
	withRobot,
} from './fixtures/with-robot'

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
				translation: { x: 0, y: 0, z: 0 },
				orientation: {
					type: 'ov_degrees',
					value: { x: 0, y: 0, z: 1, th: 0 },
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
				translation: { x: 0, y: 0, z: 100 },
				orientation: {
					type: 'ov_degrees',
					value: { x: 0, y: 0, z: 1, th: 0 },
				},
				geometry: {
					type: 'sphere',
					r: 100,
				},
			},
		},
	],
}

withRobot.beforeAll(async () => {
	const config = getE2EConfig()
	const viamClient = await connectViamClient()
	await applyMachineConfig(viamClient, config.partId, config.machineName, armConfig)
})

withRobot('arm', async ({ robotPage }) => {
	const { page } = robotPage
	const testPrefix = 'ARM'

	const frameTreeCarrot = await page.waitForSelector('[data-part="branch-trigger"]')
	await frameTreeCarrot.click()

	await expect(page.getByText('arm-1:base_link', { exact: true })).toBeVisible()

	// Exact text, not the accessible name: the derived links nest under `arm-1`,
	// so a substring match on the branch control also hits `arm-1:base_link`.
	await expect(page.getByText('arm-1', { exact: true })).toBeVisible()

	await page.getByText('arm-1', { exact: true }).click()

	await expect(page.getByRole('region', { name: 'Details panel' })).toBeVisible()

	await robotPage.screenshotCanvas(`${testPrefix}-0-loaded`)

	const { host, apiKeyId, apiKey } = getE2EConfig()
	execSync('go run e2e/fixtures/go-scripts/main.go moveArmJointPositions', {
		encoding: 'utf8',
		env: {
			...process.env,
			VIAM_E2E_HOST: host,
			VIAM_E2E_API_KEY_ID: apiKeyId,
			VIAM_E2E_API_KEY: apiKey,
		},
	})

	await robotPage.screenshotCanvas(`${testPrefix}-1-moved`)
})

withRobot.afterAll(async () => {
	const config = getE2EConfig()
	const viamClient = await connectViamClient()
	await applyMachineConfig(viamClient, config.partId, config.machineName, {})
})
