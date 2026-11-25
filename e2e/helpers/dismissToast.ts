import { expect, type Page } from '@playwright/test'

/**
 * Closes the toast showing `message` and waits until it is gone. Scoped to the toast region,
 * because prime-ui banners label their close buttons `Dismiss` too.
 */
export const dismissToast = async (page: Page, message: string) => {
	const toast = page
		.getByRole('region', { name: /^Notifications/ })
		.getByRole('status')
		.filter({ hasText: message })
	const dismissButton = toast.getByRole('button', { name: 'Dismiss' })

	await expect(dismissButton).toBeVisible({ timeout: 10000 })
	// The toast flies in from below the viewport and on CI can stay unstable for the whole
	// test timeout, so the click is dispatched. The not.toBeVisible below confirms it.
	await dismissButton.dispatchEvent('click')

	await expect(page.getByText(message)).not.toBeVisible()
}
