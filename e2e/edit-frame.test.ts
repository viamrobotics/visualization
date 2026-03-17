import { expect, test } from '@playwright/test'
import {
	createViamClient,
	JsonValue,
	Struct,
	ViamClient,
	ViamClientOptions,
} from '@viamrobotics/sdk'

import { setupMachineConfig } from './fixtures'

const testConfig = {
	host: 'motion-tools-e2e-main.l6j4r7m65g.viam.cloud',
	name: 'motion-tools-e2e-main',
	partId: '9741704d-ea0e-484c-8cf8-0a849096af1e',
	apiKeyId: '76fcaf4b-4e04-4c6b-9665-c9c663ee4fad',
	apiKeyValue: 'iz95ie2bz5h617xhs2ko9eov1b5bryas',
	signalingAddress: 'https://app.viam.com:443',
	organizationId: 'd9fd430a-25ec-47ba-b548-5d1b1b2fc6d1',
}
const fragmentIdsToDelete: string[] = []

async function connect(): Promise<ViamClient> {
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
	viamClient = await connect()
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

test('basic edit frame', async ({ browser }) => {
	const testPrefix = 'BASIC_EDIT_FRAME'
	await viamClient.appClient.updateRobotPart(
		testConfig.partId,
		testConfig.name,
		Struct.fromJson(basicEditFrameConfig)
	)
	const failedScreenshots = [] as string[]
	const context = await browser.newContext()
	let page = await context.newPage()

	page.on('console', (message) => {
		console.log(`[${message.type()}] ${message.text()}`)
	})
	await page.goto('/')
	await page.waitForLoadState('domcontentloaded')
	await expect(page.getByText('World', { exact: true })).toBeVisible()

	// SETUP CONFIG
	setupMachineConfig(page, testConfig)

	// OPEN A WORLD OBJECT AND EDIT THE FRAME
	await expect(page.getByText('base-1', { exact: true })).toBeVisible()
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
	page = await context.newPage()
	page.on('console', (message) => {
		console.log(`[${message.type()}] ${message.text()}`)
	})
	await page.goto('/')
	await page.waitForLoadState('domcontentloaded')

	await expect(page.getByText('base-1', { exact: true })).toBeVisible()
	await page.getByText('base-1', { exact: true }).click()
	await expect(page.getByTestId('details-header')).toBeVisible()
	// give page time to laod up frame details
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

test('create and delete frame', async ({ browser }) => {
	const testPrefix = 'CREATE_DELETE'
	await viamClient.appClient.updateRobotPart(
		testConfig.partId,
		testConfig.name,
		Struct.fromJson(createDeleteFrameConfig as unknown as JsonValue)
	)
	const failedScreenshots = [] as string[]
	const context = await browser.newContext()
	const page = await context.newPage()

	page.on('console', (message) => {
		console.log(`[${message.type()}] ${message.text()}`)
	})
	await page.goto('/')
	await page.waitForLoadState('domcontentloaded')
	await expect(page.getByText('World', { exact: true })).toBeVisible()

	// SETUP CONFIG
	setupMachineConfig(page, testConfig)

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

	// wait a couple seconds for the frame system to udpate
	await page.waitForTimeout(5000)

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

test('fragment edit frame', async ({ browser }) => {
	const testPrefix = 'FRAGMENT_EDIT_FRAME'
	const failedScreenshots = [] as string[]
	const resp = await viamClient.appClient.createFragment(
		testConfig.organizationId,
		'TEMP_FRAGMENT',
		Struct.fromJson(fragmentConfig as unknown as JsonValue)
	)
	if (!resp?.id) {
		throw new Error('Failed to create fragment')
	}
	fragmentIdsToDelete.push(resp.id)

	await viamClient.appClient.updateRobotPart(
		testConfig.partId,
		testConfig.name,
		Struct.fromJson(fragmentUsingConfig(resp.id) as unknown as JsonValue)
	)

	// WAIT FOR THE TREE TO LOAD
	const context = await browser.newContext()
	const page = await context.newPage()
	page.on('console', (message) => {
		console.log(`[${message.type()}] ${message.text()}`)
	})
	await page.goto('/')
	await page.waitForLoadState('domcontentloaded')
	await expect(page.getByText('World', { exact: true })).toBeVisible()

	// SETUP CONFIG
	setupMachineConfig(page, testConfig)

	try {
		await expect(page).toHaveScreenshot(`${testPrefix}-0-setup.png`, { fullPage: true })
	} catch (error) {
		console.warn(error)
		failedScreenshots.push(`${testPrefix}-0-setup.png`)
	}

	await expect(page.getByText('frag-base-1', { exact: true })).toBeVisible()
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

test.afterAll('cleanup', async () => {
	await viamClient.appClient.updateRobotPart(
		testConfig.partId,
		testConfig.name,
		Struct.fromJson({})
	)
	for (const fragmentId of fragmentIdsToDelete) {
		await viamClient.appClient.deleteFragment(fragmentId)
	}
})
