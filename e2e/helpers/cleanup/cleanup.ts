import { execSync } from 'child_process'
import { expect, Page } from '@playwright/test'

export const cleanup = async (page: Page) => {
	execSync('go run e2e/helpers/cleanup/cleanup.go', { encoding: 'utf-8' })
	await expect(page.getByText('No objects displayed')).toBeVisible()
}
