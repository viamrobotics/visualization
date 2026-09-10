import { expect, test } from './fixtures/drawing'

test.describe('deep-link mode', () => {
	test('viz.mode=build selects Build at load with no click', async ({ page, drawServer }) => {
		await page.goto(`?drawPort=${drawServer.port}&viz.mode=build`)
		await expect(page.getByRole('heading', { name: 'World', exact: true })).toBeVisible({
			timeout: 15_000,
		})

		await expect(page.getByRole('radio', { name: 'Build the scene' })).toBeChecked()
		await expect(page.getByRole('radio', { name: 'Monitor live machine data' })).not.toBeChecked()
	})

	test('viz.mode=move selects Move at load with no click', async ({ page, drawServer }) => {
		await page.goto(`?drawPort=${drawServer.port}&viz.mode=move`)
		await expect(page.getByRole('heading', { name: 'World', exact: true })).toBeVisible({
			timeout: 15_000,
		})

		await expect(
			page.getByRole('radio', { name: 'Execute movement with a motion service' })
		).toBeChecked()
	})

	test('an unrecognized viz.mode leaves the Monitor default selected', async ({
		page,
		drawServer,
	}) => {
		await page.goto(`?drawPort=${drawServer.port}&viz.mode=teleport`)
		await expect(page.getByRole('heading', { name: 'World', exact: true })).toBeVisible({
			timeout: 15_000,
		})

		await expect(page.getByRole('radio', { name: 'Monitor live machine data' })).toBeChecked()
	})
})

test.describe('deep-link selection', () => {
	test('viz.select selects an entity drawn after load with no click', async ({
		page,
		drawServer,
		drawScene,
	}) => {
		await page.goto(`?drawPort=${drawServer.port}&viz.mode=build&viz.select=lifecycle-box`)
		await expect(page.getByRole('heading', { name: 'World', exact: true })).toBeVisible({
			timeout: 15_000,
		})

		drawScene('lifecycle/add')

		await expect(
			page.getByLabel('Tree View').getByText('lifecycle-box', { exact: true })
		).toBeVisible({
			timeout: 10_000,
		})

		await expect(page.getByRole('radio', { name: 'Build the scene' })).toBeChecked()

		const detailsPanels = page.getByRole('region', { name: 'Details panel' })
		await expect(detailsPanels).toHaveCount(1, { timeout: 10_000 })
		await expect(detailsPanels).toContainText('lifecycle-box')
	})
})
