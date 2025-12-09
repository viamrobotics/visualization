import { Browser, Page } from '@playwright/test'
import { expect } from '@playwright/test'
import { createViamClient } from '@viamrobotics/sdk'
import { ViamClientOptions } from '@viamrobotics/sdk'
import { ViamClient } from '@viamrobotics/sdk'
import * as fs from 'fs'

const testConfig = {
	host: 'motion-tools-e2e-main.l6j4r7m65g.viam.cloud',
	name: 'motion-tools-e2e-main',
	partId: '9741704d-ea0e-484c-8cf8-0a849096af1e',
	apiKeyId: '76fcaf4b-4e04-4c6b-9665-c9c663ee4fad',
	apiKeyValue: 'iz95ie2bz5h617xhs2ko9eov1b5bryas',
	signalingAddress: 'https://app.viam.com:443',
	organizationId: 'd9fd430a-25ec-47ba-b548-5d1b1b2fc6d1',
}

interface TestPage {
	page: Page
	testConfig: typeof testConfig
	failedScreenshots: string[]
	refresh: () => Promise<void>
	takeScreenshot: (testPrefix: string) => Promise<void>
	assertScreenshots: () => void
	dropFile: (file: string | { name: string; content: string }) => Promise<void>
	connect: () => Promise<ViamClient>
}

export const createPage = async (browser: Browser): Promise<TestPage> => {
	const context = await browser.newContext()
	const page = await context.newPage()
	let failedScreenshots: string[] = []

	page.on('console', (message) => {
		console.log(`[${message.type()}] ${message.text()}`)
	})

	await page.goto('/')
	await page.waitForLoadState('networkidle')
	await expect(page.getByRole('heading', { name: 'World', exact: true })).toBeVisible({
		timeout: 15000,
	})

	const refresh = async () => {
		failedScreenshots = []
		await page.reload()
		await page.waitForLoadState('networkidle')
		await expect(page.getByRole('heading', { name: 'World', exact: true })).toBeVisible({
			timeout: 15000,
		})
	}

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

	const dropFile = async (file: string | { name: string; content: string }) => {
		let base64Data: string
		let fileName: string

		if (typeof file === 'string') {
			// File path provided - read from disk
			const fileBuffer = fs.readFileSync(file)
			base64Data = fileBuffer.toString('base64')
			fileName = file.split('/').pop() ?? file
		} else {
			// Synthetic file - encode content as base64
			base64Data = Buffer.from(file.content).toString('base64')
			fileName = file.name
		}

		await page.evaluate(
			({ base64Data, fileName }) => {
				const binaryString = atob(base64Data)
				const bytes = new Uint8Array(binaryString.length)
				for (let i = 0; i < binaryString.length; i++) {
					bytes[i] = binaryString.charCodeAt(i)
				}

				const file = new File([bytes], fileName, { type: 'application/octet-stream' })
				const dataTransfer = new DataTransfer()
				dataTransfer.items.add(file)

				window.dispatchEvent(
					new DragEvent('dragenter', {
						bubbles: true,
						cancelable: true,
						dataTransfer,
					})
				)

				const dropZone = document.querySelector('[aria-label="File drop zone"]')
				if (!dropZone) {
					throw new Error('Drop zone not found')
				}

				dropZone.dispatchEvent(
					new DragEvent('drop', {
						bubbles: true,
						cancelable: true,
						dataTransfer,
					})
				)
			},
			{ base64Data, fileName }
		)
	}

	const connect = async (): Promise<ViamClient> => {
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

	return {
		get page() {
			return page
		},
		get testConfig() {
			return testConfig
		},
		get failedScreenshots() {
			return failedScreenshots
		},

		refresh,
		dropFile,
		connect,
		takeScreenshot,
		assertScreenshots,
	}
}
