import { expect } from '@playwright/test'
import { JsonValue, Struct, type ViamClient } from '@viamrobotics/sdk'

import {
	connectOrgViamClient,
	connectViamClient,
	type E2ETestConfig,
	getE2EConfig,
	injectMachineConfig,
	withRobot,
} from './fixtures/with-robot'

const fragmentIdsToDelete: string[] = []

let viamClient: ViamClient
let orgViamClient: ViamClient
let config: E2ETestConfig

withRobot.beforeAll(async () => {
	config = getE2EConfig()
	viamClient = await connectViamClient()
	orgViamClient = await connectOrgViamClient()
})

const basicEditFrameConfig = {
	components: [
		{
			name: 'base-1',
			api: 'rdk:component:base',
			model: 'rdk:builtin:fake',
			attributes: {},
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
			name: 'parent',
			api: 'rdk:component:base',
			model: 'rdk:builtin:fake',
			attributes: {},
			frame: {
				parent: 'world',
				translation: { x: 0, y: 0, z: 250 },
				orientation: {
					type: 'ov_degrees',
					value: { x: 0, y: 0, z: 1, th: 0 },
				},
			},
		},
	],
}

withRobot.beforeAll(async () => {
	const config = getE2EConfig()
	const viamClient = await connectViamClient()
	await viamClient.appClient.updateRobotPart(
		config.partId,
		config.machineName,
		Struct.fromJson(basicEditFrameConfig as unknown as JsonValue)
	)
})

withRobot('basic edit frame', async ({ robotPage }) => {
	const testPrefix = 'BASIC_EDIT_FRAME'
	await viamClient.appClient.updateRobotPart(
		config.partId,
		config.machineName,
		Struct.fromJson(basicEditFrameConfig)
	)
	const failedScreenshots = [] as string[]
	const { page } = robotPage

	page.on('console', (message) => {
		console.log(`[${message.type()}] ${message.text()}`)
	})

	// OPEN A WORLD OBJECT AND EDIT THE FRAME
	await expect(page.getByText('base-1', { exact: true })).toBeVisible({ timeout: 15_000 })
	await page.getByText('base-1', { exact: true }).click()

	await expect(page.getByTestId('details-header')).toBeVisible()

	await expect(page.getByText('Box', { exact: true })).toBeVisible()
	await page.getByText('Box', { exact: true }).click()

	await expect(page.getByLabel('mutable local position x coordinate')).toBeVisible()
	await page.getByLabel('mutable local position x coordinate').fill('100')
	await expect(page.getByLabel('mutable local position y coordinate')).toBeVisible()
	await page.getByLabel('mutable local position y coordinate').fill('200')
	await expect(page.getByLabel('mutable local position z coordinate')).toBeVisible()
	await page.getByLabel('mutable local position z coordinate').fill('300')

	await expect(page.getByLabel('mutable box dimensions x value')).toBeVisible()
	await page.getByLabel('mutable box dimensions x value').fill('400')
	await expect(page.getByLabel('mutable box dimensions y value')).toBeVisible()
	await page.getByLabel('mutable box dimensions y value').fill('500')
	await expect(page.getByLabel('mutable box dimensions z value')).toBeVisible()
	await page.getByLabel('mutable box dimensions z value').fill('600')

	await expect(page.getByText('Live updates paused', { exact: true })).toBeVisible()
	try {
		await expect(page).toHaveScreenshot(`${testPrefix}-0-edited.png`, {
			fullPage: true,
			threshold: 0.1,
		})
	} catch (error) {
		console.warn(error)
		failedScreenshots.push(`${testPrefix}-0-edited.png`)
	}

	// SAVE THE CHANGES
	await page.getByLabel('Save').click()
	await expect(page.getByText('Live updates paused', { exact: true })).toBeHidden()
	try {
		await expect(page).toHaveScreenshot(`${testPrefix}-1-saved.png`, {
			fullPage: true,
			threshold: 0.1,
		})
	} catch (error) {
		console.warn(error)
		failedScreenshots.push(`${testPrefix}-1-saved.png`)
	}

	// RELOAD THE PAGE
	page.on('console', (message) => {
		console.log(`[${message.type()}] ${message.text()}`)
	})
	await page.reload({ waitUntil: 'domcontentloaded' })

	const machineConfigButton = page.getByRole('button', { name: 'Machine connection configs' })
	await expect(machineConfigButton.getByText('live', { exact: true })).toBeVisible({
		timeout: 15_000,
	})
	await expect(page.getByText('base-1', { exact: true })).toBeVisible()
	await page.getByText('base-1', { exact: true }).click()
	await expect(page.getByTestId('details-header')).toBeVisible()
	try {
		await expect(page).toHaveScreenshot(`${testPrefix}-2-reloaded.png`, {
			fullPage: true,
			threshold: 0.1,
		})
	} catch (error) {
		console.warn(error)
		failedScreenshots.push(`${testPrefix}-2-reloaded.png`)
	}

	// REPARENT THE OBJECT
	await expect(page.getByLabel('dropdown parent frame name')).toBeVisible()
	await page.getByLabel('dropdown parent frame name').click()
	await page.getByLabel('dropdown parent frame name').selectOption('parent')

	try {
		await expect(page).toHaveScreenshot(`${testPrefix}-3-parented.png`, { fullPage: true })
	} catch (error) {
		console.warn(error)
		failedScreenshots.push(`${testPrefix}-3-parented.png`)
	}

	// DISCARD CHANGES
	await expect(page.getByText('Live updates paused', { exact: true })).toBeVisible()
	await page.getByText('Discard', { exact: true }).click()
	await expect(page.getByText('Live updates paused', { exact: true })).toBeHidden()
	try {
		await expect(page).toHaveScreenshot(`${testPrefix}-4-discarded.png`, { fullPage: true })
	} catch (error) {
		console.warn(error)
		failedScreenshots.push(`${testPrefix}-4-discarded.png`)
	}

	// RESTORE THE ORIGINAL FRAME
	await expect(page.getByText('None', { exact: true }).first()).toBeVisible()
	await page.getByText('None', { exact: true }).first().click()

	await expect(page.getByLabel('mutable local position x coordinate')).toBeVisible()
	await page.getByLabel('mutable local position x coordinate').fill('0')
	await expect(page.getByLabel('mutable local position y coordinate')).toBeVisible()
	await page.getByLabel('mutable local position y coordinate').fill('0')
	await expect(page.getByLabel('mutable local position z coordinate')).toBeVisible()
	await page.getByLabel('mutable local position z coordinate').fill('0')

	// SAVE THE CHANGES
	await expect(page.getByText('Live updates paused', { exact: true })).toBeVisible()
	await page.getByLabel('Save').click()
	await expect(page.getByText('Live updates paused', { exact: true })).toBeHidden()
	try {
		await expect(page).toHaveScreenshot(`${testPrefix}-5-restored.png`, { fullPage: true })
	} catch (error) {
		console.warn(error)
		failedScreenshots.push(`${testPrefix}-5-restored.png`)
	}

	if (failedScreenshots.length > 0) {
		console.log(`Failed screenshots: ${failedScreenshots.join(', ')}`)
		throw new Error(`Failed screenshots: ${failedScreenshots.join(', ')}`)
	}
})

const createDeleteFrameConfig = {
	components: [
		{
			name: 'base-1',
			api: 'rdk:component:base',
			model: 'rdk:builtin:fake',
			attributes: {},
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
			name: 'no-frame',
			api: 'rdk:component:base',
			model: 'rdk:builtin:fake',
			attributes: {},
		},
	],
}

withRobot('create and delete frame', async ({ browser }) => {
	const testPrefix = 'CREATE_DELETE'
	await viamClient.appClient.updateRobotPart(
		config.partId,
		config.machineName,
		Struct.fromJson(createDeleteFrameConfig as unknown as JsonValue)
	)
	const failedScreenshots = [] as string[]
	const context = await browser.newContext()
	const page = await context.newPage()

	page.on('console', (message) => {
		console.log(`[${message.type()}] ${message.text()}`)
	})
	await page.goto('/')
	await injectMachineConfig(page, config)
	await page.reload()
	await page.waitForLoadState('domcontentloaded')

	const machineConfigButton = page.getByRole('button', { name: 'Machine connection configs' })
	await expect(machineConfigButton.getByText('live', { exact: true })).toBeVisible({
		timeout: 15_000,
	})

	// ADD A FRAME & SAVE
	await expect(page.getByLabel('Add frames', { exact: true })).toBeVisible()
	page.getByLabel('Add frames', { exact: true }).click()

	await expect(page.getByRole('button', { name: 'Add frame', exact: true })).toBeVisible()
	page.getByRole('button', { name: 'Add frame', exact: true }).click()

	try {
		await expect(page).toHaveScreenshot(`${testPrefix}-0-added.png`, { fullPage: true })
	} catch (error) {
		console.warn(error)
		failedScreenshots.push(`${testPrefix}-0-added.png`)
	}

	await expect(page.getByText('Live updates paused', { exact: true })).toBeVisible()
	await page.getByLabel('Save').click()
	await expect(page.getByText('Live updates paused', { exact: true })).toBeHidden()

	// DELETE A FRAME
	await expect(page.getByText('base-1', { exact: true })).toBeVisible()
	await page.getByText('base-1', { exact: true }).click()
	await expect(page.getByText('Delete frame', { exact: true })).toBeVisible()
	page.getByText('Delete frame', { exact: true }).click()

	try {
		await expect(page).toHaveScreenshot(`${testPrefix}-1-deleted.png`, { fullPage: true })
	} catch (error) {
		console.warn(error)
		failedScreenshots.push(`${testPrefix}-1-deleted.png`)
	}

	// DISCARD CHANGES
	await expect(page.getByText('Live updates paused', { exact: true })).toBeVisible()
	await page.getByText('Discard', { exact: true }).click()
	await expect(page.getByText('Live updates paused', { exact: true })).toBeHidden()
	try {
		await expect(page).toHaveScreenshot(`${testPrefix}-2-discarded.png`, { fullPage: true })
	} catch (error) {
		console.warn(error)
		failedScreenshots.push(`${testPrefix}-2-discarded.png`)
	}

	if (failedScreenshots.length > 0) {
		console.log(`Failed screenshots: ${failedScreenshots.join(', ')}`)
		throw new Error(`Failed screenshots: ${failedScreenshots.join(', ')}`)
	}
})

const fragmentConfig = {
	components: [
		{
			name: 'frag-base-1',
			api: 'rdk:component:base',
			model: 'rdk:builtin:fake',
			attributes: {},
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
			name: 'frag-base-2',
			api: 'rdk:component:base',
			model: 'rdk:builtin:fake',
			attributes: {},
			frame: {
				parent: 'world',
				translation: { x: 10, y: 10, z: 0 },
				orientation: {
					type: 'ov_degrees',
					value: { x: 0, y: 0, z: 1, th: 0 },
				},
			},
		},
	],
}

const fragmentUsingConfig = (fragmentId: string) => {
	return {
		components: [
			{
				name: 'base-1',
				api: 'rdk:component:base',
				model: 'rdk:builtin:fake',
				attributes: {},
				frame: {
					parent: 'world',
					translation: { x: 0, y: 0, z: 0 },
					orientation: {
						type: 'ov_degrees',
						value: { x: 0, y: 0, z: 1, th: 0 },
					},
				},
			},
		],
		fragments: [
			{
				id: fragmentId,
			},
		],
	}
}

withRobot('fragment edit frame', async ({ browser }) => {
	const testPrefix = 'FRAGMENT_EDIT_FRAME'
	const failedScreenshots = [] as string[]
	const resp = await orgViamClient.appClient.createFragment(
		config.orgId,
		'TEMP_FRAGMENT',
		Struct.fromJson(fragmentConfig as unknown as JsonValue)
	)
	if (!resp?.id) {
		throw new Error('Failed to create fragment')
	}
	fragmentIdsToDelete.push(resp.id)

	await viamClient.appClient.updateRobotPart(
		config.partId,
		config.machineName,
		Struct.fromJson(fragmentUsingConfig(resp.id) as unknown as JsonValue)
	)

	const context = await browser.newContext()
	const page = await context.newPage()
	page.on('console', (message) => {
		console.log(`[${message.type()}] ${message.text()}`)
	})
	await page.goto('/')
	await injectMachineConfig(page, config)
	await page.reload()
	await page.waitForLoadState('domcontentloaded')

	const machineConfigButton = page.getByRole('button', { name: 'Machine connection configs' })
	await expect(machineConfigButton.getByText('live', { exact: true })).toBeVisible({
		timeout: 15_000,
	})

	await expect(page.getByText('frag-base-1', { exact: true })).toBeVisible({ timeout: 15_000 })

	try {
		await expect(page).toHaveScreenshot(`${testPrefix}-0-setup.png`, { fullPage: true })
	} catch (error) {
		console.warn(error)
		failedScreenshots.push(`${testPrefix}-0-setup.png`)
	}

	await page.getByText('frag-base-1', { exact: true }).click()

	await expect(page.getByTestId('details-header')).toBeVisible()

	await expect(page.getByText('Sphere', { exact: true })).toBeVisible()
	await page.getByText('Sphere', { exact: true }).click()

	await expect(page.getByLabel('mutable local position x coordinate')).toBeVisible()
	await page.getByLabel('mutable local position x coordinate').fill('100')
	await expect(page.getByLabel('mutable local position y coordinate')).toBeVisible()
	await page.getByLabel('mutable local position y coordinate').fill('200')
	await expect(page.getByLabel('mutable local position z coordinate')).toBeVisible()
	await page.getByLabel('mutable local position z coordinate').fill('300')

	await expect(page.getByLabel('mutable sphere dimensions radius value')).toBeVisible()
	await page.getByLabel('mutable sphere dimensions radius value').fill('400')

	// SAVE THE CHANGES
	await expect(page.getByText('Live updates paused', { exact: true })).toBeVisible()
	await page.getByLabel('Save').click()
	await expect(page.getByText('Live updates paused', { exact: true })).toBeHidden()

	try {
		await expect(page).toHaveScreenshot(`${testPrefix}-1-saved.png`, {
			fullPage: true,
			threshold: 0.1,
		})
	} catch (error) {
		console.warn(error)
		failedScreenshots.push(`${testPrefix}-1-saved.png`)
	}

	if (failedScreenshots.length > 0) {
		console.log(`Failed screenshots: ${failedScreenshots.join(', ')}`)
		throw new Error(`Failed screenshots: ${failedScreenshots.join(', ')}`)
	}
})

withRobot.afterAll(async () => {
	await viamClient.appClient.updateRobotPart(config.partId, config.machineName, Struct.fromJson({}))
	for (const fragmentId of fragmentIdsToDelete) {
		await orgViamClient.appClient.deleteFragment(fragmentId)
	}
})
