import { expect } from '@playwright/test'
import { type JsonValue, Struct } from '@viamrobotics/sdk'
import path from 'node:path'
import url from 'node:url'

import { connectViamClient, getE2EConfig, withRobot } from './fixtures/with-robot'

const dirname = path.dirname(url.fileURLToPath(import.meta.url))
const moduleBinPath = path.resolve(dirname, '.bin/obstacle-store')

const SLOTS = 8

const getObstacleConfig = () => ({
	modules: [
		{
			type: 'local',
			name: 'e2e-obstacle-store',
			executable_path: moduleBinPath,
		},
	],
	components: [
		{
			name: 'obstacle-sensor',
			api: 'rdk:component:sensor',
			model: 'viam-viz:obstacles:sensor',
			attributes: {},
		},
	],
	services: [
		{
			name: 'world-state-store',
			api: 'rdk:service:world_state_store',
			model: 'viam-viz:obstacles:store',
			attributes: {},
			depends_on: ['obstacle-sensor'],
		},
	],
})

withRobot.beforeAll(async () => {
	const config = getE2EConfig()
	const viamClient = await connectViamClient()
	await viamClient.appClient.updateRobotPart(
		config.partId,
		config.machineName,
		Struct.fromJson(getObstacleConfig() as unknown as JsonValue)
	)

	// Give viam-server time to load the module and configure both resources
	await new Promise((resolve) => setTimeout(resolve, 10000))
})

withRobot.afterAll(async () => {
	const config = getE2EConfig()
	const viamClient = await connectViamClient()
	await viamClient.appClient.updateRobotPart(config.partId, config.machineName, Struct.fromJson({}))
})

withRobot('obstacle store: obstacles appear in tree', async ({ robotPage }) => {
	const { page } = robotPage

	// At t≈0 slots 0..4 are present (sin(phase) > -0.3 for phases 0, 0.7, 1.4, 2.1, 2.8).
	// We wait on a few of those to confirm the module + sensor + store + stream pipeline is up.
	await expect(page.getByText('obs-0', { exact: true })).toBeVisible({ timeout: 30000 })
	await expect(page.getByText('obs-1', { exact: true })).toBeVisible({ timeout: 5000 })
	await expect(page.getByText('obs-2', { exact: true })).toBeVisible({ timeout: 5000 })
})

withRobot('obstacle store: obstacles churn over time', async ({ robotPage }) => {
	const { page } = robotPage

	const visibleObs = async (): Promise<Set<number>> => {
		const present = new Set<number>()
		for (let i = 0; i < SLOTS; i++) {
			const count = await page.getByText(`obs-${i}`, { exact: true }).count()
			if (count > 0) present.add(i)
		}
		return present
	}

	await expect(page.getByText('obs-0', { exact: true })).toBeVisible({ timeout: 30000 })

	const before = await visibleObs()
	expect(before.size).toBeGreaterThan(0)

	// Visibility cycle is sin(t * 0.1 + phase) > -0.3, period ~62s. In an 8s
	// window at least one slot crosses the threshold (e.g. slot 4 goes
	// non-visible around t≈10s). That's enough to prove ADDED/REMOVED are
	// flowing through the stream end-to-end.
	await page.waitForTimeout(8000)

	const after = await visibleObs()
	expect(after.size).toBeGreaterThan(0)

	const symmetricDiff = [...before, ...after].filter((i) => before.has(i) !== after.has(i))
	expect(symmetricDiff.length).toBeGreaterThan(0)
})

withRobot('obstacle store: stable UUIDs across polls', async ({ robotPage }) => {
	const { page } = robotPage

	// Slot 0 (phase=0) stays visible for the entire first half of the cycle (~30s),
	// so it's the safest to click and hold a selection on for several polls.
	// Scope to the tree treeitem so we don't also match the obs-0 label that
	// appears in the details panel after selection.
	const obs0 = page.getByRole('treeitem', { name: 'obs-0', exact: true })
	await expect(obs0).toBeVisible({ timeout: 30000 })

	await obs0.click()
	await expect(page.getByTestId('details-header')).toBeVisible()

	// Wait for several poll cycles (poll = 1s). If UUIDs were re-derived on
	// every poll, the entity would churn ADDED/REMOVED and the selection
	// would drop. Stable UUIDs ⇒ UPDATED events on the same entity ⇒
	// selection persists.
	await page.waitForTimeout(5000)

	await expect(page.getByTestId('details-header')).toBeVisible()
	await expect(obs0).toBeVisible()
})
