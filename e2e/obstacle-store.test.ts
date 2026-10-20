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

	// Elapsed time, and it is load-bearing. The browser subscribes once on
	// connect, so a service that appears after the page loads never reaches it,
	// and dropping this made the first test in this file fail outright. It cannot
	// become a poll: the machine is only reachable over WebRTC from a browser, and
	// `createRobotClient` hangs when called from the test process.
	// Give viam-server time to load the module and configure both resources.
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

	// The visibility cycle is sin(t * 0.1 + phase) > -0.3, period about 62s, so a slot
	// crosses the threshold every few seconds. Polling for the crossing rather than
	// sleeping through a worst case ends this as soon as ADDED and REMOVED have both
	// been seen, and says which one is missing when they have not.
	let after = before
	await expect
		.poll(
			async () => {
				after = await visibleObs()
				return [...before, ...after].filter((i) => before.has(i) !== after.has(i)).length
			},
			{ timeout: 30_000, intervals: [500] }
		)
		.toBeGreaterThan(0)

	expect(after.size).toBeGreaterThan(0)
})

withRobot('obstacle store: stable UUIDs across polls', async ({ robotPage }) => {
	const { page } = robotPage

	// Slot 0 (phase=0) stays visible for the first half of the cycle, about 30s, so a
	// selection on it survives several polls. Scope to the tree treeitem to avoid the
	// obs-0 label the details panel adds after selection.
	const obs0 = page.getByRole('treeitem', { name: 'obs-0', exact: true })
	await expect(obs0).toBeVisible({ timeout: 30000 })

	await obs0.click()
	await expect(page.getByRole('region', { name: 'Details panel' })).toBeVisible()

	// Elapsed time on purpose, not a readiness guess. This asserts that something
	// does not happen across several 1s poll cycles: re-derived UUIDs would churn
	// the entity through ADDED and REMOVED and drop the selection, while stable
	// UUIDs mean UPDATED on the same entity. There is no event to poll for, so the
	// cycles have to actually pass.
	await page.waitForTimeout(5000)

	await expect(page.getByRole('region', { name: 'Details panel' })).toBeVisible()
	await expect(obs0).toBeVisible()
})
