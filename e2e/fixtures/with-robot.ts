import { test as base, expect, type Page } from '@playwright/test'
import { createViamClient, type ViamClient, type ViamClientOptions } from '@viamrobotics/sdk'

const getE2EConfig = () => {
	const host = process.env.VIAM_E2E_HOST
	const partId = process.env.VIAM_E2E_PART_ID
	const machineName = process.env.VIAM_E2E_MACHINE_NAME
	const robotId = process.env.VIAM_E2E_ROBOT_ID
	const apiKeyId = process.env.VIAM_E2E_API_KEY_ID
	const apiKey = process.env.VIAM_E2E_API_KEY
	const orgId = process.env.VIAM_E2E_ORG_ID
	const signalingAddress = process.env.VIAM_E2E_SIGNALING_ADDRESS ?? 'https://app.viam.com:443'

	if (!host || !partId || !machineName || !robotId || !apiKeyId || !apiKey || !orgId) {
		throw new Error(
			'Missing E2E environment variables. The global setup may not have run.\n' +
				'Make sure playwright.config.ts has globalSetup configured.'
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
	failedScreenshots: string[]
	takeScreenshot: (testPrefix: string) => Promise<void>
	assertScreenshots: () => void
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

				localStorage.setItem('active-connection-config', '0')
			}),
		config
	)
}

export const connectViamClient = async (): Promise<ViamClient> => {
	const config = getE2EConfig()
	const opts: ViamClientOptions = {
		serviceHost: config.signalingAddress,
		credentials: {
			type: 'api-key',
			authEntity: config.apiKeyId,
			payload: config.apiKey,
		},
	}
	return createViamClient(opts)
}

export const connectOrgViamClient = async (): Promise<ViamClient> => {
	const orgApiKeyId = process.env.VIAM_E2E_ORG_API_KEY_ID
	const orgApiKey = process.env.VIAM_E2E_ORG_API_KEY
	const signalingAddress = process.env.VIAM_E2E_SIGNALING_ADDRESS ?? 'https://app.viam.com:443'

	if (!orgApiKeyId || !orgApiKey) {
		throw new Error(
			'Missing VIAM_E2E_ORG_API_KEY_ID / VIAM_E2E_ORG_API_KEY env vars.\n' +
				'These are required for org-level operations like fragment management.'
		)
	}

	const opts: ViamClientOptions = {
		serviceHost: signalingAddress,
		credentials: {
			type: 'api-key',
			authEntity: orgApiKeyId,
			payload: orgApiKey,
		},
	}
	return createViamClient(opts)
}

export const withRobot = base.extend<{ robotPage: RobotTestPage }>({
	robotPage: async ({ browser }, use) => {
		const config = getE2EConfig()
		const context = await browser.newContext()
		const page = await context.newPage()
		const failedScreenshots: string[] = []

		page.on('console', (message) => {
			console.log(`[${message.type()}] ${message.text()}`)
		})

		// Navigate first to establish the origin, then inject config
		await page.goto('/')
		await injectMachineConfig(page, config)
		await page.reload()

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

		const takeScreenshot = async (testPrefix: string) => {
			try {
				await expect(page).toHaveScreenshot(`${testPrefix}.png`, {
					fullPage: true,
					threshold: 0.1,
				})
			} catch (error) {
				console.warn(error)
				failedScreenshots.push(`${testPrefix}.png`)
			}
		}

		const assertScreenshots = () => {
			if (failedScreenshots.length > 0) {
				console.log(`Failed screenshots: ${failedScreenshots.join(', ')}`)
				throw new Error(`Failed screenshots: ${failedScreenshots.join(', ')}`)
			}
		}

		await use({
			page,
			config,
			viamClient: client,
			failedScreenshots,
			takeScreenshot,
			assertScreenshots,
		})

		await context.close()
	},
})

export { getE2EConfig }
