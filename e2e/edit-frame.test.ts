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

/** A named row of number fields, such as `local position (mm)`, with one field per axis label. */
const axisFields = (page: Page, group: string) => page.getByRole('group', { name: group })

const fillAxes = async (page: Page, group: string, values: Record<string, string>) => {
	for (const [axis, value] of Object.entries(values)) {
		await axisFields(page, group).getByRole('spinbutton', { name: axis, exact: true }).fill(value)
	}
}

const expectAxes = async (page: Page, group: string, values: Record<string, string>) => {
	for (const [axis, value] of Object.entries(values)) {
		await expect(
			axisFields(page, group).getByRole('spinbutton', { name: axis, exact: true })
		).toHaveValue(value)
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

/** The frame the cloud holds for a component, which is what Save is supposed to have written. */
const readSavedFrame = async (componentName: string) => {
	const { configJson } = await viamClient.appClient.getRobotPart(config.partId)
	const saved = JSON.parse(configJson) as {
		components?: { name: string; frame?: Record<string, unknown> }[]
	}
	return saved.components?.find((component) => component.name === componentName)?.frame
}

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
	await applyMachineConfig(viamClient, config.partId, config.machineName, basicEditFrameConfig)
	const { page } = robotPage

	page.on('console', (message) => {
		console.log(`[${message.type()}] ${message.text()}`)
	})

	await expect(page.getByText('base-1', { exact: true })).toBeVisible({ timeout: 15_000 })
	await enterBuildMode(page)
	await page.getByText('base-1', { exact: true }).click()

	await expect(page.getByRole('region', { name: 'Details panel' })).toBeVisible()

	await page.getByRole('tab', { name: 'Box' }).click()

	const position = { X: '100', Y: '200', Z: '300' }
	await fillAxes(page, 'local position (mm)', position)
	await fillAxes(page, 'box dimensions (mm)', { X: '400', Y: '500', Z: '600' })

	await expectHasEdits(page)

	await page.getByLabel('Save').click()
	await expectNoEdits(page)
	await expect
		.poll(() => readSavedFrame('base-1'))
		.toMatchObject({
			translation: { x: 100, y: 200, z: 300 },
			geometry: { type: 'box', x: 400, y: 500, z: 600 },
		})

	page.on('console', (message) => {
		console.log(`[${message.type()}] ${message.text()}`)
	})
	await page.reload({ waitUntil: 'domcontentloaded' })

	const machineConfigButton = page.getByRole('button', { name: /^Machine connection:/ })
	await expect(machineConfigButton.getByText('live', { exact: true })).toBeVisible({
		timeout: 15_000,
	})
	await expect(page.getByText('base-1', { exact: true })).toBeVisible()
	await page.getByText('base-1', { exact: true }).click()
	await expect(page.getByRole('region', { name: 'Details panel' })).toBeVisible()

	// Reload reset the workspace toggle to Monitor, so re-enter Build first.
	await enterBuildMode(page)
	await expectAxes(page, 'local position (mm)', position)

	const parentSelect = page.getByRole('combobox', { name: 'parent frame' })
	await parentSelect.click()
	await page.getByRole('option', { name: 'parent', exact: true }).click()
	await expect(parentSelect).toHaveText('parent')

	await expectHasEdits(page)
	await page.getByText('Discard', { exact: true }).click()
	await expectNoEdits(page)
	await expect(parentSelect).toHaveText('world')

	await page.getByRole('tab', { name: 'None' }).click()

	await fillAxes(page, 'local position (mm)', { X: '0', Y: '0', Z: '0' })

	await expectHasEdits(page)
	await page.getByLabel('Save').click()
	await expectNoEdits(page)
	await expect
		.poll(() => readSavedFrame('base-1'))
		.toMatchObject({ parent: 'world', translation: { x: 0, y: 0, z: 0 } })
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

	const machineConfigButton = page.getByRole('button', { name: /^Machine connection:/ })
	await expect(machineConfigButton.getByText('live', { exact: true })).toBeVisible({
		timeout: 15_000,
	})

	await enterBuildMode(page)
	await expect(page.getByText('Frameless components')).toBeVisible()
	await page.getByText('Frameless components').click()
	await page.getByText('no-frame', { exact: true }).click()

	await expect(page.getByRole('button', { name: 'Add frame', exact: true })).toBeVisible()
	page.getByRole('button', { name: 'Add frame', exact: true }).click()

	await expectHasEdits(page)
	await page.getByLabel('Save').click()
	await expectNoEdits(page)
	await expect
		.poll(() => readSavedFrame('no-frame'))
		.toMatchObject({ parent: 'world', translation: { x: 0, y: 0, z: 0 } })

	const treeView = page.getByLabel('Tree View')
	await expect(treeView.getByText('base-1', { exact: true })).toBeVisible()
	await treeView.getByText('base-1', { exact: true }).click()
	await expect(page.getByText('Delete frame', { exact: true })).toBeVisible()
	page.getByText('Delete frame', { exact: true }).click()

	await expectHasEdits(page)
	await expect(page.getByText('Delete frame', { exact: true })).toBeHidden()

	await page.getByText('Discard', { exact: true }).click()
	await expectNoEdits(page)
	await treeView.getByText('base-1', { exact: true }).first().click()
	await expect(page.getByText('Delete frame', { exact: true })).toBeVisible()
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

	const machineConfigButton = page.getByRole('button', { name: /^Machine connection:/ })
	await expect(machineConfigButton.getByText('live', { exact: true })).toBeVisible({
		timeout: 15_000,
	})

	await expect(page.getByText('frag-base-1', { exact: true })).toBeVisible({ timeout: 15_000 })

	const openFragmentFrame = async () => {
		await enterBuildMode(page)
		await page.getByText('frag-base-1', { exact: true }).click()
		await expect(page.getByRole('region', { name: 'Details panel' })).toBeVisible()
	}

	await openFragmentFrame()

	await page.getByRole('tab', { name: 'Sphere' }).click()

	const position = { X: '100', Y: '200', Z: '300' }
	const sphere = { R: '400' }
	await fillAxes(page, 'local position (mm)', position)
	await fillAxes(page, 'sphere dimensions (mm)', sphere)

	await expectHasEdits(page)

	await page.getByLabel('Save').click()
	await expectNoEdits(page)

	// Fragment edits save as fragment_mods, so the reloaded frame proves the mods resolve back
	// to the edited values rather than only that something was written.
	await page.reload({ waitUntil: 'domcontentloaded' })
	await expect(machineConfigButton.getByText('live', { exact: true })).toBeVisible({
		timeout: 15_000,
	})
	await openFragmentFrame()
	await expectAxes(page, 'local position (mm)', position)
	await expectAxes(page, 'sphere dimensions (mm)', sphere)
})

withRobot.afterAll(async () => {
	await applyMachineConfig(viamClient, config.partId, config.machineName, {})
	for (const fragmentId of fragmentIdsToDelete) {
		await orgViamClient.appClient.deleteFragment(fragmentId)
	}
})
