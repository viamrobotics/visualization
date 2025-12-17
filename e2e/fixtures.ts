import { Page } from "@playwright/test";
import { expect } from "@playwright/test";

interface TestConfig {
    host: string
    partId: string
    apiKeyId: string
    apiKeyValue: string
    signalingAddress: string
}

export const setupMachineConfig = async (page: Page, testConfig: TestConfig) => {
    const machineConfigButton = page.getByRole('radio', { name: 'Machine connection configs' })
	await expect(machineConfigButton).toBeVisible()
	await machineConfigButton.click()

	await expect(page.getByText('Add config', { exact: true })).toBeVisible()
	await page.getByText('Add config', { exact: true }).click()

	await expect(page.getByPlaceholder(/host/iu)).toBeVisible()
	await page.getByPlaceholder(/host/iu).fill(testConfig.host)
	await page.getByRole('button', { name: 'Expand connection config' }).click()
	await expect(page.getByPlaceholder(/part id/iu)).toBeVisible()
	await page.getByPlaceholder(/part id/iu).fill(testConfig.partId)
	await expect(page.getByPlaceholder(/api key id/iu)).toBeVisible()
	await page.getByPlaceholder(/api key id/iu).fill(testConfig.apiKeyId)
	await expect(page.getByPlaceholder(/api key value/iu)).toBeVisible()
	await page.getByPlaceholder(/api key value/iu).fill(testConfig.apiKeyValue)
	await expect(page.getByPlaceholder(/signaling address/iu)).toBeVisible()
	await page.getByPlaceholder(/signaling address/iu).fill(testConfig.signalingAddress)

	await page.getByLabel('Close connection configs panel').click()
}