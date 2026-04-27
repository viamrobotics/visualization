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
	const failedScreenshots: string[] = []

	const frameTreeCarrot = await page.waitForSelector('[data-part="branch-indicator"]')
	await frameTreeCarrot.click()

	await expect(page.getByText('arm-1:base_link', { exact: true })).toBeVisible()
	await expect(page.getByRole('button', { name: 'arm-1' })).toBeVisible()

	await page.getByRole('button', { name: 'arm-1' }).click()

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
	execSync('go run e2e/fixtures/go-scripts/main.go moveArmJointPositions', {
		encoding: 'utf8',
		env: {
			...process.env,
			VIAM_E2E_HOST: process.env.VIAM_E2E_HOST,
			VIAM_E2E_API_KEY_ID: process.env.VIAM_E2E_API_KEY_ID,
			VIAM_E2E_API_KEY: process.env.VIAM_E2E_API_KEY,
		},
	})

	try {
		await expect(page).toHaveScreenshot(`${testPrefix}-1-moved.png`, {
			fullPage: true,
			threshold: 0.1,
		})
	} catch (error) {
		console.warn(error)
		failedScreenshots.push(`${testPrefix}-1-moved.png`)
	}

	if (failedScreenshots.length > 0) {
		console.log(`Failed screenshots: ${failedScreenshots.join(', ')}`)
		throw new Error(`Failed screenshots: ${failedScreenshots.join(', ')}`)
	}
})

withRobot.afterAll(async () => {
	const config = getE2EConfig()
	const viamClient = await connectViamClient()
	await applyMachineConfig(viamClient, config.partId, config.machineName, {})
})
