import { expect, test } from '@playwright/test'
import { JsonValue, Struct, ViamClient } from '@viamrobotics/sdk'
import { createPage } from './helpers/create-page'
import { assertNoFailedScreenshots, takeScreenshot } from './helpers/take-screenshot'
import { connect, testConfig } from './helpers/connect'

const fragmentIdsToDelete: string[] = []
let viamClient: ViamClient

test.beforeAll(async () => {
	viamClient = await connect()
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
	const { page, failedScreenshots, refresh } = await createPage(browser)

	await viamClient.appClient.updateRobotPart(
		testConfig.partId,
		testConfig.name,
		Struct.fromJson(basicEditFrameConfig)
	)

	await page.waitForTimeout(5000)

	// SETUP CONFIG
	await expect(page.getByTestId('icon-robot-outline')).toBeVisible()
	await page.getByTestId('icon-robot-outline').click()

	await expect(page.getByText('Add config', { exact: true })).toBeVisible()
	await page.getByText('Add config', { exact: true }).click()

	await expect(page.getByPlaceholder('Host')).toBeVisible()
	await page.getByPlaceholder('Host').fill(testConfig.host)
	await expect(page.getByPlaceholder('Part ID')).toBeVisible()
	await page.getByPlaceholder('Part ID').fill(testConfig.partId)
	await expect(page.getByPlaceholder('API Key ID')).toBeVisible()
	await page.getByPlaceholder('API Key ID').fill(testConfig.apiKeyId)
	await expect(page.getByPlaceholder('API Key Value')).toBeVisible()
	await page.getByPlaceholder('API Key Value').fill(testConfig.apiKeyValue)
	await expect(page.getByPlaceholder('Signaling Address')).toBeVisible()
	await page.getByPlaceholder('Signaling Address').fill(testConfig.signalingAddress)

	await page.getByTestId('icon-close').click()

	// OPEN A WORLD OBJECT AND EDIT THE FRAME
	const tree = page.locator('[role="tree"]')
	await expect(tree.getByText('base-1', { exact: true })).toBeVisible()
	await tree.getByText('base-1', { exact: true }).click()

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
	await takeScreenshot(page, `${testPrefix}-0-edited`, failedScreenshots, { fullPage: true })

	// SAVE THE CHANGES
	await page.getByText('Save', { exact: true }).click()
	await expect(page.getByText('Live updates paused', { exact: true })).toBeHidden()
	await takeScreenshot(page, `${testPrefix}-1-saved`, failedScreenshots, { fullPage: true })
	// give network some time to sync the config
	await page.waitForTimeout(5000)

	// RELOAD THE PAGE
	await refresh()
	await expect(tree.getByText('base-1', { exact: true })).toBeVisible()
	await tree.getByText('base-1', { exact: true }).click()
	await expect(page.getByTestId('details-header')).toBeVisible()
	// give page time to laod up frame details
	await takeScreenshot(page, `${testPrefix}-2-reloaded`, failedScreenshots, { fullPage: true })

	// REPARENT THE OBJECT
	await expect(page.getByLabel('dropdown parent frame name')).toBeVisible()
	await page.getByLabel('dropdown parent frame name').click()
	await page.getByLabel('dropdown parent frame name').selectOption('parent')

	await takeScreenshot(page, `${testPrefix}-3-parented`, failedScreenshots, { fullPage: true })

	// DISCARD CHANGES
	await expect(page.getByText('Live updates paused', { exact: true })).toBeVisible()
	await page.getByText('Discard', { exact: true }).click()
	await expect(page.getByText('Live updates paused', { exact: true })).toBeHidden()
	await takeScreenshot(page, `${testPrefix}-4-discarded`, failedScreenshots, { fullPage: true })

	// RESTORE THE ORIGINAL FRAME
	await expect(page.getByText('None', { exact: true })).toBeVisible()
	await page.getByText('None', { exact: true }).click()

	await expect(page.getByLabel('mutable local position x coordinate')).toBeVisible()
	await page.getByLabel('mutable local position x coordinate').fill('0')
	await expect(page.getByLabel('mutable local position y coordinate')).toBeVisible()
	await page.getByLabel('mutable local position y coordinate').fill('0')
	await expect(page.getByLabel('mutable local position z coordinate')).toBeVisible()
	await page.getByLabel('mutable local position z coordinate').fill('0')

	// SAVE THE CHANGES
	await expect(page.getByText('Live updates paused', { exact: true })).toBeVisible()
	await page.getByText('Save', { exact: true }).click()
	await expect(page.getByText('Live updates paused', { exact: true })).toBeHidden()
	await takeScreenshot(page, `${testPrefix}-5-restored`, failedScreenshots, { fullPage: true })

	assertNoFailedScreenshots(failedScreenshots)
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
	const { page, failedScreenshots, refresh } = await createPage(browser)

	await viamClient.appClient.updateRobotPart(
		testConfig.partId,
		testConfig.name,
		Struct.fromJson(createDeleteFrameConfig as unknown as JsonValue)
	)

	// SETUP CONFIG
	await expect(page.getByTestId('icon-robot-outline')).toBeVisible()
	await page.getByTestId('icon-robot-outline').click()

	await expect(page.getByText('Add config', { exact: true })).toBeVisible()
	await page.getByText('Add config', { exact: true }).click()

	await expect(page.getByPlaceholder('Host')).toBeVisible()
	await page.getByPlaceholder('Host').fill(testConfig.host)
	await expect(page.getByPlaceholder('Part ID')).toBeVisible()
	await page.getByPlaceholder('Part ID').fill(testConfig.partId)
	await expect(page.getByPlaceholder('API Key ID')).toBeVisible()
	await page.getByPlaceholder('API Key ID').fill(testConfig.apiKeyId)
	await expect(page.getByPlaceholder('API Key Value')).toBeVisible()
	await page.getByPlaceholder('API Key Value').fill(testConfig.apiKeyValue)
	await expect(page.getByPlaceholder('Signaling Address')).toBeVisible()
	await page.getByPlaceholder('Signaling Address').fill(testConfig.signalingAddress)

	await page.getByTestId('icon-close').click()

	// WAIT FOR THE TREE DRAWER TO LOAD
	await expect(page.getByText('base-1', { exact: true })).toBeVisible()

	// ADD A FRAME & SAVE
	await expect(page.getByText('Add frames', { exact: true })).toBeVisible()
	page.getByText('Add frames', { exact: true }).click()

	await expect(page.getByTestId('icon-plus')).toBeVisible()
	page.getByTestId('icon-plus').click()

	await takeScreenshot(page, `${testPrefix}-0-added`, failedScreenshots, { fullPage: true })

	await expect(page.getByText('Live updates paused', { exact: true })).toBeVisible()
	await page.getByText('Save', { exact: true }).click()
	await expect(page.getByText('Live updates paused', { exact: true })).toBeHidden()

	// wait a couple seconds for the frame system to udpate
	await page.waitForTimeout(5000)

	// DELETE A FRAME
	await expect(page.getByText('base-1', { exact: true })).toBeVisible()
	await page.getByText('base-1', { exact: true }).click()
	await expect(page.getByText('Delete frame', { exact: true })).toBeVisible()
	page.getByText('Delete frame', { exact: true }).click()

	await takeScreenshot(page, `${testPrefix}-1-deleted`, failedScreenshots, { fullPage: true })

	// DISCARD CHANGES
	await expect(page.getByText('Live updates paused', { exact: true })).toBeVisible()
	await page.getByText('Discard', { exact: true }).click()
	await expect(page.getByText('Live updates paused', { exact: true })).toBeHidden()
	await takeScreenshot(page, `${testPrefix}-2-discarded`, failedScreenshots, { fullPage: true })

	assertNoFailedScreenshots(failedScreenshots)
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

test('fragement edit frame', async ({ browser }) => {
	const testPrefix = 'FRAGMENT_EDIT_FRAME'
	const { page, failedScreenshots } = await createPage(browser)

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

	// SETUP CONFIG
	await expect(page.getByTestId('icon-robot-outline')).toBeVisible()
	await page.getByTestId('icon-robot-outline').click()

	await expect(page.getByText('Add config', { exact: true })).toBeVisible()
	await page.getByText('Add config', { exact: true }).click()

	await expect(page.getByPlaceholder('Host')).toBeVisible()
	await page.getByPlaceholder('Host').fill(testConfig.host)
	await expect(page.getByPlaceholder('Part ID')).toBeVisible()
	await page.getByPlaceholder('Part ID').fill(testConfig.partId)
	await expect(page.getByPlaceholder('API Key ID')).toBeVisible()
	await page.getByPlaceholder('API Key ID').fill(testConfig.apiKeyId)
	await expect(page.getByPlaceholder('API Key Value')).toBeVisible()
	await page.getByPlaceholder('API Key Value').fill(testConfig.apiKeyValue)
	await expect(page.getByPlaceholder('Signaling Address')).toBeVisible()
	await page.getByPlaceholder('Signaling Address').fill(testConfig.signalingAddress)

	await page.getByTestId('icon-close').click()

	// WAIT FOR THE TREE DRAWER TO LOAD
	await expect(page.getByText('frag-base-1', { exact: true })).toBeVisible()

	await takeScreenshot(page, `${testPrefix}-0-setup`, failedScreenshots, { fullPage: true })

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
	await page.getByText('Save', { exact: true }).click()
	await expect(page.getByText('Live updates paused', { exact: true })).toBeHidden()

	await takeScreenshot(page, `${testPrefix}-1-saved`, failedScreenshots, { fullPage: true })

	assertNoFailedScreenshots(failedScreenshots)
})
