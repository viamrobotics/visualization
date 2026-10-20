import { test as base, expect, type Page } from '@playwright/test'
import { type JsonValue, Struct, type ViamClient } from '@viamrobotics/sdk'

import { APP_ADDRESS, connectAppClient } from '../helpers/appClient'
import { loadE2EConfig } from '../helpers/e2e-config'
import { machineStatePath, readMachineState } from '../helpers/machineState'
import { screenshotCanvas } from '../helpers/screenshot'

const getE2EConfig = () => {
	const state = readMachineState()
	const {
		host,
		partId,
		machineName,
		robotId,
		apiKeyId,
		apiKey,
		orgId,
		signalingAddress = APP_ADDRESS,
	} = state ?? {}

	if (!host || !partId || !machineName || !robotId || !apiKeyId || !apiKey || !orgId) {
		throw new Error(
			`Incomplete machine state at ${machineStatePath}.\n` +
				'The robot-setup project writes it. Run the robot specs through the robot\n' +
				'project (pnpm test:e2e:robot) so that dependency fires.'
		)
	}

	return {
		host,
		partId,
		machineName,
		robotId,
		apiKeyId,
		apiKey,
		orgId,
		signalingAddress,
	}
}

export type E2ETestConfig = ReturnType<typeof getE2EConfig>

export interface RobotTestPage {
	page: Page
	config: E2ETestConfig
	viamClient: ViamClient
	takeScreenshot: (testPrefix: string) => Promise<void>
	screenshotCanvas: (testPrefix: string) => Promise<void>
}

export const injectMachineConfig = async (page: Page, config: E2ETestConfig) => {
	await page.evaluate(
		(cfg) =>
			new Promise<void>((resolve, reject) => {
				const connectionConfig = {
					host: cfg.host,
					partId: cfg.partId,
					apiKeyId: cfg.apiKeyId,
					apiKeyValue: cfg.apiKey,
					signalingAddress: cfg.signalingAddress,
				}

				const request = indexedDB.open('keyval-store')
				request.onerror = () => reject(request.error)
				request.onupgradeneeded = () => {
					request.result.createObjectStore('keyval')
				}
				request.onsuccess = () => {
					const db = request.result
					const tx = db.transaction('keyval', 'readwrite')
					tx.objectStore('keyval').put([connectionConfig], 'connection-configs')
					tx.oncomplete = () => {
						db.close()
						resolve()
					}
					tx.onerror = () => {
						db.close()
						reject(tx.error)
					}
				}

				// Leave the active config unset (-1). The fixture activates the injected entry by
				// host after reload, because the merged-list index depends on how many env
				// configs the running dev server serves, which the test cannot know.
				localStorage.setItem('active-connection-config', '-1')
			}),
		config
	)
}

export const activateConnectionConfigByHost = async (page: Page, host: string) => {
	const configButton = page.getByRole('button', { name: 'Machine connection configs' })
	await configButton.click()

	await expect(async () => {
		const rows = page.locator('form').filter({
			has: page.locator('input[placeholder="Host"]'),
		})
		const count = await rows.count()
		for (let index = 0; index < count; index += 1) {
			const row = rows.nth(index)
			if ((await row.locator('input[placeholder="Host"]').inputValue()) === host) {
				const switchButton = row.getByRole('switch')
				if ((await switchButton.getAttribute('aria-checked')) !== 'true') {
					await switchButton.click()
				}
				return
			}
		}
		throw new Error(`Connection config row for host "${host}" not found`)
	}).toPass({ timeout: 10_000 })

	await configButton.click()
}

export const connectViamClient = async (): Promise<ViamClient> => {
	const config = getE2EConfig()
	return connectAppClient(config.apiKeyId, config.apiKey, config.signalingAddress)
}

interface ApplyMachineConfigOptions {
	settleMs?: number
}

/**
 * Pushes a config to the machine and gives viam-server time to apply it.
 *
 * The wait is elapsed time because there is nothing to poll. `getRobotPart`
 * only proves the cloud accepted the config, and the machine itself cannot be
 * dialled from here: `createRobotClient` needs a browser for WebRTC and hangs
 * in the test process.
 */
export const applyMachineConfig = async (
	client: ViamClient,
	partId: string,
	machineName: string,
	config: Record<string, unknown>,
	options: ApplyMachineConfigOptions = {}
): Promise<void> => {
	const { settleMs = 5000 } = options

	await client.appClient.updateRobotPart(
		partId,
		machineName,
		Struct.fromJson(config as unknown as JsonValue)
	)

	await new Promise((resolve) => setTimeout(resolve, settleMs))
}

/** Org-scoped credentials from `.env.e2e`, for operations a machine key cannot do (e.g. fragment management). */
export const connectOrgViamClient = async (): Promise<ViamClient> => {
	const config = loadE2EConfig()
	return connectAppClient(config.apiKeyId, config.apiKey)
}

export const withRobot = base.extend<{ robotPage: RobotTestPage }>({
	robotPage: async ({ browser }, use) => {
		const config = getE2EConfig()
		const context = await browser.newContext()
		const page = await context.newPage()

		page.on('console', (message) => {
			console.log(`[${message.type()}] ${message.text()}`)
		})

		// Navigate first to establish the origin, then inject config. goto('') rather
		// than '/', so a baseURL that carries a path resolves correctly instead of
		// jumping to the host root.
		await page.goto('')
		await injectMachineConfig(page, config)
		await page.reload()
		await activateConnectionConfigByHost(page, config.host)

		const machineConfigButton = page.getByRole('button', { name: 'Machine connection configs' })

		const maxRetries = 5
		let connected = false
		for (let attempt = 1; attempt <= maxRetries; attempt += 1) {
			try {
				await expect(machineConfigButton.getByText('live', { exact: true })).toBeVisible({
					timeout: 15_000,
				})
				connected = true
				break
			} catch {
				if (attempt < maxRetries) {
					console.log(
						`Connection attempt ${attempt} failed, retrying (${attempt}/${maxRetries})...`
					)
					await page.reload()
					await page.waitForTimeout(2000)
				}
			}
		}

		if (!connected) {
			throw new Error(`Machine failed to show "live" status after ${maxRetries} attempts.`)
		}

		const client = await connectViamClient()

		const takeScreenshot = (testPrefix: string) =>
			expect.soft(page).toHaveScreenshot(`${testPrefix}.png`, { fullPage: true })

		const takeCanvasScreenshot = (testPrefix: string) => screenshotCanvas(page, testPrefix)

		await use({
			page,
			config,
			viamClient: client,
			takeScreenshot,
			screenshotCanvas: takeCanvasScreenshot,
		})

		await context.close()
	},
})

export { getE2EConfig }
