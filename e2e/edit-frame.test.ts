import { expect, test } from '@playwright/test'

const testConfig = {
	host: 'edit-frame-testing-main.i6h2oo7033.viam.cloud',
	partId: '9b304d77-b1d5-4c96-a64f-4088772b9961',
	apiKeyId: 'b6c1c558-aac2-4f52-9a17-b5d6cf9df5f7',
	apiKeyValue: 'g70dv014fq3fe4qtfs7f6l99xeufmu2l',
	signalingAddress: 'https://app.viam.com:443',
}
// {
// 	"components": [
// 	  {
// 		"name": "base-1",
// 		"api": "rdk:component:base",
// 		"model": "rdk:builtin:fake",
// 		"attributes": {},
// 		"frame": {
// 		  "parent": "world",
// 		  "translation": {
// 			"x": 0,
// 			"y": 0,
// 			"z": 0
// 		  },
// 		  "orientation": {
// 			"type": "ov_degrees",
// 			"value": {
// 			  "x": 0,
// 			  "y": 0,
// 			  "z": 1,
// 			  "th": 0
// 			}
// 		  }
// 		}
// 	  }
// 	]
// }

test('basic edit frame', async ({ browser }) => {
	const context = await browser.newContext()
	await context.addCookies([
		{ name: 'MOTION_TOOLS_EDIT_FRAME', value: 'true', domain: 'localhost', path: '/' },
	])
	let page = await context.newPage()
	page.on('console', (message) => {
		console.log(`[${message.type()}] ${message.text()}`)
	})
	await page.goto('/')
	await expect(page.getByText('World')).toBeVisible()

	// SETUP CONFIG
	await expect(page.getByTestId('icon-robot-outline')).toBeVisible()
	await page.getByTestId('icon-robot-outline').click()

	await expect(page.getByText('Add Config')).toBeVisible()
	await page.getByText('Add Config').click()

	await expect(page.getByPlaceholder('Host')).toBeVisible()
	await page.getByPlaceholder('Host').fill(testConfig.host)
	await expect(page.getByPlaceholder('Part ID')).toBeVisible()
	await page.getByPlaceholder('Part ID').fill(testConfig.partId)
	await expect(page.getByPlaceholder('API Key ID')).toBeVisible()
	await page.getByPlaceholder('API Key ID').fill(testConfig.apiKeyId)
	await expect(page.getByPlaceholder('API Key Value')).toBeVisible()
	await page.getByPlaceholder('API Key Value').fill(testConfig.apiKeyValue)
	await expect(page.getByPlaceholder('Signaling Address')).toBeVisible()
	await page.getByPlaceholder('Signaling Address').fill(testConfig.signalingAddress)

	await page.getByTestId('icon-close').click()

	// OPEN A WORLD OBJECT AND EDIT THE FRAME
	await expect(page.getByText('base-1')).toBeVisible()
	await page.getByText('base-1').click()

	await expect(page.getByText('Details')).toBeVisible()

	await expect(page.getByText('Box')).toBeVisible()
	await page.getByText('Box').click()

	await expect(page.getByLabel('mutable local position x coordinate')).toBeVisible()
	await page.getByLabel('mutable local position x coordinate').fill('100')
	await expect(page.getByLabel('mutable local position y coordinate')).toBeVisible()
	await page.getByLabel('mutable local position y coordinate').fill('200')
	await expect(page.getByLabel('mutable local position z coordinate')).toBeVisible()
	await page.getByLabel('mutable local position z coordinate').fill('300')

	await expect(page.getByLabel('mutable box dimensions x value')).toBeVisible()
	await page.getByLabel('mutable box dimensions x value').fill('400')
	await expect(page.getByLabel('mutable box dimensions y value')).toBeVisible()
	await page.getByLabel('mutable box dimensions y value').fill('500')
	await expect(page.getByLabel('mutable box dimensions z value')).toBeVisible()
	await page.getByLabel('mutable box dimensions z value').fill('600')

	await expect(page.getByText('Live Updates Paused')).toBeVisible()
	await expect(page).toHaveScreenshot('0-edited.png', { fullPage: true, threshold: 0.1 })

	// SAVE THE CHANGES
	await page.getByText('Save').click()
	await expect(page.getByText('Live Updates Paused')).toBeHidden()
	await expect(page).toHaveScreenshot('1-saved.png', { fullPage: true, threshold: 0.1 })
	// give network some time to sync the config
	await page.waitForTimeout(3000)

	// RELOAD THE PAGE
	page = await context.newPage()
	page.on('console', (message) => {
		console.log(`[${message.type()}] ${message.text()}`)
	})
	await page.goto('/')
	await expect(page.getByText('base-1')).toBeVisible()
	await page.getByText('base-1').click()

	await expect(page.getByText('Details')).toBeVisible()
	await expect(page).toHaveScreenshot('2-reloaded.png', { fullPage: true, threshold: 0.1 })

	// REVERT THE CHANGES
	await expect(page.getByText('None')).toBeVisible()
	await page.getByText('None').click()

	await expect(page.getByLabel('mutable local position x coordinate')).toBeVisible()
	await page.getByLabel('mutable local position x coordinate').fill('0')
	await expect(page.getByLabel('mutable local position y coordinate')).toBeVisible()
	await page.getByLabel('mutable local position y coordinate').fill('0')
	await expect(page.getByLabel('mutable local position z coordinate')).toBeVisible()
	await page.getByLabel('mutable local position z coordinate').fill('0')

	// SAVE THE CHANGES
	await expect(page.getByText('Live Updates Paused')).toBeVisible()
	await page.getByText('Save').click()
	await expect(page.getByText('Live Updates Paused')).toBeHidden()
	await expect(page).toHaveScreenshot('3-reverted.png', { fullPage: true })

	
})
