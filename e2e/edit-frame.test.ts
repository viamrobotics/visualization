import { expect, type Page } from '@playwright/test'
import { type JsonValue, Struct, type ViamClient } from '@viamrobotics/sdk'

import {
	activateConnectionConfigByHost,
	applyMachineConfig,
	connectOrgViamClient,
	connectViamClient,
	type E2ETestConfig,
	getE2EConfig,
	injectMachineConfig,
	withRobot,
} from './fixtures/with-robot'

// Each frame-edit section is a tweakpane widget wrapped in a div with one
// aria-label, and the inputs inside are positional by axis. Tweakpane commits
// only on Enter or blur, so press Enter after each fill.
const fillFrameInputs = async (page: Page, groupLabel: string, values: string[]) => {
	const inputs = page.getByLabel(groupLabel).locator('input')
	for (const [index, value] of values.entries()) {
		const input = inputs.nth(index)
		await input.fill(value)
		await input.press('Enter')
	}
}

// Frame editing is only available in Build mode. The workspace toggle defaults to
// Monitor and resets to it on reload, so switch to Build before any edit.
const enterBuildMode = async (page: Page) => {
	const build = page.getByRole('radio', { name: 'Build the scene' })
	await build.click()
	await expect(build).toHaveAttribute('aria-checked', 'true')
}

// The "Live updates paused" banner stays visible for all of Build mode. Save and
// Discard enable only when edits are unsaved, so the Save button's disabled state
// is the dirty signal, not the banner.
const expectHasEdits = (page: Page) =>
	expect(page.getByLabel('Save')).not.toHaveAttribute('aria-disabled', 'true')
const expectNoEdits = (page: Page) =>
	expect(page.getByLabel('Save')).toHaveAttribute('aria-disabled', 'true')

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
	await applyMachineConfig(viamClient, config.partId, config.machineName, basicEditFrameConfig)
})

withRobot('basic edit frame', async ({ robotPage }) => {
	const testPrefix = 'BASIC_EDIT_FRAME'
	await applyMachineConfig(viamClient, config.partId, config.machineName, basicEditFrameConfig)
	const { page } = robotPage

	page.on('console', (message) => {
		console.log(`[${message.type()}] ${message.text()}`)
	})

	await expect(page.getByText('base-1', { exact: true })).toBeVisible({ timeout: 15_000 })
	await enterBuildMode(page)
	await page.getByText('base-1', { exact: true }).click()

	await expect(page.getByRole('region', { name: 'Details panel' })).toBeVisible()

	await expect(page.getByText('Box', { exact: true })).toBeVisible()
	await page.getByText('Box', { exact: true }).click()

	// The "mutable ..." aria-label divs are invisible Svelte wrappers whose content
	// is portaled into Tweakpane's own pane DOM. Assert attachment rather than
	// visibility.
	await expect(page.getByLabel('mutable local position')).toBeAttached()
	await fillFrameInputs(page, 'mutable local position', ['100', '200', '300'])

	// "mutable box dimensions" attaches when the entity gets a Box trait, but the
	// inputs live in the outer Tweakpane pane DOM under "mutable geometry", not
	// under this wrapper.
	await expect(page.getByLabel('mutable box dimensions')).toBeAttached()
	await fillFrameInputs(page, 'mutable geometry', ['400', '500', '600'])

	await expectHasEdits(page)
	await expect.soft(page).toHaveScreenshot(`${testPrefix}-0-edited.png`, { fullPage: true })

	await page.getByLabel('Save').click()
	await expectNoEdits(page)
	await expect.soft(page).toHaveScreenshot(`${testPrefix}-1-saved.png`, { fullPage: true })

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
	await expect(page.getByRole('region', { name: 'Details panel' })).toBeVisible()
	await expect.soft(page).toHaveScreenshot(`${testPrefix}-2-reloaded.png`, { fullPage: true })

	// Reload reset the workspace toggle to Monitor, so re-enter Build first.
	await enterBuildMode(page)
	await expect(page.getByLabel('mutable parent frame')).toBeAttached()
	await page.getByLabel('mutable parent frame').locator('select').selectOption('parent')

	await expect.soft(page).toHaveScreenshot(`${testPrefix}-3-parented.png`, { fullPage: true })

	await expectHasEdits(page)
	await page.getByText('Discard', { exact: true }).click()
	await expectNoEdits(page)
	await expect.soft(page).toHaveScreenshot(`${testPrefix}-4-discarded.png`, { fullPage: true })

	await expect(page.getByText('None', { exact: true }).first()).toBeVisible()
	await page.getByText('None', { exact: true }).first().click()

	await expect(page.getByLabel('mutable local position')).toBeAttached()
	await fillFrameInputs(page, 'mutable local position', ['0', '0', '0'])

	await expectHasEdits(page)
	await page.getByLabel('Save').click()
	await expectNoEdits(page)
	await expect.soft(page).toHaveScreenshot(`${testPrefix}-5-restored.png`, { fullPage: true })
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
	await applyMachineConfig(viamClient, config.partId, config.machineName, createDeleteFrameConfig)
	const context = await browser.newContext()
	const page = await context.newPage()

	page.on('console', (message) => {
		console.log(`[${message.type()}] ${message.text()}`)
	})
	// goto('') rather than '/', so a baseURL that carries a path resolves correctly
	// instead of jumping to the host root.
	await page.goto('')
	await injectMachineConfig(page, config)
	await page.reload()
	await page.waitForLoadState('domcontentloaded')
	await activateConnectionConfigByHost(page, config.host)

	const machineConfigButton = page.getByRole('button', { name: 'Machine connection configs' })
	await expect(machineConfigButton.getByText('live', { exact: true })).toBeVisible({
		timeout: 15_000,
	})

	await enterBuildMode(page)
	await expect(page.getByLabel('Add frames', { exact: true })).toBeVisible()
	page.getByLabel('Add frames', { exact: true }).click()

	await expect(page.getByRole('button', { name: 'Add frame', exact: true })).toBeVisible()
	page.getByRole('button', { name: 'Add frame', exact: true }).click()

	await expect.soft(page).toHaveScreenshot(`${testPrefix}-0-added.png`, { fullPage: true })

	await expectHasEdits(page)
	await page.getByLabel('Save').click()
	await expectNoEdits(page)

	await expect(page.getByText('base-1', { exact: true })).toBeVisible()
	await page.getByText('base-1', { exact: true }).click()
	await expect(page.getByText('Delete frame', { exact: true })).toBeVisible()
	page.getByText('Delete frame', { exact: true }).click()

	await expect.soft(page).toHaveScreenshot(`${testPrefix}-1-deleted.png`, { fullPage: true })

	await expectHasEdits(page)
	await page.getByText('Discard', { exact: true }).click()
	await expectNoEdits(page)
	await expect.soft(page).toHaveScreenshot(`${testPrefix}-2-discarded.png`, { fullPage: true })
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
	const resp = await orgViamClient.appClient.createFragment(
		config.orgId,
		'TEMP_FRAGMENT',
		Struct.fromJson(fragmentConfig as unknown as JsonValue)
	)
	if (!resp?.id) {
		throw new Error('Failed to create fragment')
	}
	fragmentIdsToDelete.push(resp.id)

	await applyMachineConfig(
		viamClient,
		config.partId,
		config.machineName,
		fragmentUsingConfig(resp.id)
	)

	const context = await browser.newContext()
	const page = await context.newPage()
	page.on('console', (message) => {
		console.log(`[${message.type()}] ${message.text()}`)
	})
	// goto('') rather than '/', so a baseURL that carries a path resolves correctly
	// instead of jumping to the host root.
	await page.goto('')
	await injectMachineConfig(page, config)
	await page.reload()
	await page.waitForLoadState('domcontentloaded')
	await activateConnectionConfigByHost(page, config.host)

	const machineConfigButton = page.getByRole('button', { name: 'Machine connection configs' })
	await expect(machineConfigButton.getByText('live', { exact: true })).toBeVisible({
		timeout: 15_000,
	})

	await expect(page.getByText('frag-base-1', { exact: true })).toBeVisible({ timeout: 15_000 })

	await expect.soft(page).toHaveScreenshot(`${testPrefix}-0-setup.png`, { fullPage: true })

	await enterBuildMode(page)
	await page.getByText('frag-base-1', { exact: true }).click()

	await expect(page.getByRole('region', { name: 'Details panel' })).toBeVisible()

	await expect(page.getByText('Sphere', { exact: true })).toBeVisible()
	await page.getByText('Sphere', { exact: true }).click()

	await expect(page.getByLabel('mutable local position')).toBeAttached()
	await fillFrameInputs(page, 'mutable local position', ['100', '200', '300'])

	await expect(page.getByLabel('mutable sphere dimensions')).toBeAttached()
	await fillFrameInputs(page, 'mutable geometry', ['400'])

	await expectHasEdits(page)
	await page.getByLabel('Save').click()
	await expectNoEdits(page)

	await expect.soft(page).toHaveScreenshot(`${testPrefix}-1-saved.png`, { fullPage: true })
})

withRobot.afterAll(async () => {
	await applyMachineConfig(viamClient, config.partId, config.machineName, {})
	for (const fragmentId of fragmentIdsToDelete) {
		await orgViamClient.appClient.deleteFragment(fragmentId)
	}
})
