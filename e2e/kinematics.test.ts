import type { Download, Locator, Page } from '@playwright/test'

import { execFile } from 'node:child_process'
import fs from 'node:fs/promises'
import path from 'node:path'
import url from 'node:url'
import { promisify } from 'node:util'

import { expect, test } from './fixtures/drawing'

const execFileAsync = promisify(execFile)

const __filename = url.fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const CUBE_STL = path.resolve(__dirname, '../kinematics/testdata/cube-300mm.stl')
const FINGER_STL = path.resolve(__dirname, '../kinematics/testdata/finger-20x20x80mm.stl')
const SPHERE_STL = path.resolve(__dirname, '../kinematics/testdata/sphere-100mm.stl')
const URDF_PACKAGE = path.resolve(__dirname, '../kinematics/urdf/testdata/two-finger-gripper')
const EXPECTED_ZIP_ENTRIES = [
	'kinematics.json',
	'cube-300mm.stl',
	'kinematics/model.json',
	'kinematics/kinematics.go',
]

const BUILD_TIMEOUT_MS = 15_000

const SNAP_STEP_MM = 100
const DRAG_STEPS = 12
const HANDLE_CENTER_FRACTION = 0.6
const DRAG_DISTANCE_M = 0.3
const CAMERA_POSITION = [3, 3, 3]
const CAMERA_UP = [0, 0, 1]
const TRANSFORM_CONTROLS_VIEW_SCALE = 1.9
const TRANSFORM_CONTROLS_SIZE_DIVISOR = 4

type Vec3 = number[]

const subtract = (a: Vec3, b: Vec3): Vec3 => a.map((value, index) => value - b[index]!)
const dot = (a: Vec3, b: Vec3) => a.reduce((sum, value, index) => sum + value * b[index]!, 0)
const length = (a: Vec3) => Math.hypot(...a)
const normalize = (a: Vec3): Vec3 => a.map((value) => value / length(a))
const cross = (a: Vec3, b: Vec3): Vec3 => [
	a[1]! * b[2]! - a[2]! * b[1]!,
	a[2]! * b[0]! - a[0]! * b[2]!,
	a[0]! * b[1]! - a[1]! * b[0]!,
]

const addFiles = (page: Page, files: string | Parameters<Locator['setInputFiles']>[0]) =>
	page.getByTestId('kinematics-files-input').setInputFiles(files)

const openExportMenu = async (page: Page) => {
	await page.getByRole('button', { name: 'Export', exact: true }).click()
	return page.getByRole('region', { name: 'Model report', exact: true })
}

const downloadPackage = async (page: Page) => {
	const downloadPromise = page.waitForEvent('download')
	await page.getByRole('button', { name: 'Add to an existing module' }).click()
	return downloadPromise
}

const expectZipEntries = async (download: Download, entries: string[]) => {
	const bytes = await fs.readFile(await download.path())
	expect(bytes.subarray(0, 2).toString('latin1')).toBe('PK')
	const contents = bytes.toString('latin1')
	for (const entry of entries) {
		expect(contents, `zip entry ${entry}`).toContain(entry)
	}
}

const treeRow = (page: Page, name: string) =>
	page.locator('[data-scope="tree-view"][data-part="item"], [data-part="branch-control"]').filter({
		has: page.locator('[data-part="item-text"], [data-part="branch-text"]', {
			hasText: new RegExp(String.raw`^\s*${name}\s*$`),
		}),
	})

/** Opens collapsed branches, outermost first, until the row is visible. */
const revealTreeNode = async (page: Page, row: Locator) => {
	const collapsed = page.locator('[data-part="branch-control"] button[aria-label="Expand"]')
	while (!(await row.isVisible()) && (await collapsed.count()) > 0) {
		await collapsed.first().click()
	}
}

/** Selects a node by name, opening collapsed folders and branches on the way. */
const selectTreeNode = async (page: Page, name: string) => {
	const row = treeRow(page, name)
	await revealTreeNode(page, row)
	await row.click()
	return page.locator('#details-panel')
}

/** The tree branch for a node, whose content holds its children. */
const treeBranch = (page: Page, name: string) =>
	page.locator('[data-part="branch"]').filter({
		has: page.locator(':scope > [data-part="branch-control"] [data-part="branch-text"]', {
			hasText: new RegExp(String.raw`^\s*${name}\s*$`),
		}),
	})

/** Opens collapsed branches until the node is visible, then asserts it. */
const expectTreeNode = async (page: Page, name: string) => {
	const row = treeRow(page, name)
	await revealTreeNode(page, row)
	await expect(row).toBeVisible()
}

const expectUnder = async (page: Page, parent: string, child: string) => {
	const content = treeBranch(page, parent).locator(':scope > [data-part="branch-content"]')
	await expect(
		content.locator('[data-part="item-text"], [data-part="branch-text"]').filter({
			hasText: new RegExp(String.raw`^\s*${child}\s*$`),
		})
	).toHaveCount(1)
}

const setSliderField = async (panel: Locator, label: string, value: string) => {
	const input = panel.locator(`[aria-label="mutable ${label}"] input`).first()
	await input.fill(value)
	await input.press('Enter')
}

const enableSnapping = async (page: Page) => {
	const snapping = page.getByRole('switch', { name: 'Snapping', exact: true })
	await snapping.click()
	await expect(snapping).toBeChecked()
}

/**
 * Where a world point lands on the canvas, for the default camera at `CAMERA_POSITION` looking at
 * the origin, with the field of view read off the live camera.
 */
const projectToCanvas = async (page: Page, point: Vec3) => {
	const box = (await page.locator('canvas').first().boundingBox())!
	const fovDegrees = await page.evaluate(
		() =>
			(globalThis as unknown as { cameraControls: { camera: { fov: number } } }).cameraControls
				.camera.fov
	)
	const forward = normalize(subtract([0, 0, 0], CAMERA_POSITION))
	const right = normalize(cross(forward, CAMERA_UP))
	const up = cross(right, forward)
	const offset = subtract(point, CAMERA_POSITION)
	const depth = dot(offset, forward)
	const halfHeight = Math.tan((fovDegrees * Math.PI) / 360)
	const ndcX = dot(offset, right) / (depth * halfHeight * (box.width / box.height))
	const ndcY = dot(offset, up) / (depth * halfHeight)
	return {
		x: box.x + ((ndcX + 1) / 2) * box.width,
		y: box.y + ((1 - ndcY) / 2) * box.height,
	}
}

/** The gizmo's size follows the camera distance: one unit is a quarter of the view height at the origin. */
const gizmoUnit = async (page: Page) => {
	const fovDegrees = await page.evaluate(
		() =>
			(globalThis as unknown as { cameraControls: { camera: { fov: number } } }).cameraControls
				.camera.fov
	)
	return (
		(length(CAMERA_POSITION) *
			TRANSFORM_CONTROLS_VIEW_SCALE *
			Math.tan((fovDegrees * Math.PI) / 360)) /
		TRANSFORM_CONTROLS_SIZE_DIVISOR
	)
}

const addFingers = async (page: Page) => {
	const fingerBuffer = await fs.readFile(FINGER_STL)
	await addFiles(page, [
		{ name: 'cube-300mm.stl', mimeType: 'model/stl', buffer: await fs.readFile(CUBE_STL) },
		{ name: 'left-finger.stl', mimeType: 'model/stl', buffer: fingerBuffer },
		{ name: 'right-finger.stl', mimeType: 'model/stl', buffer: fingerBuffer },
	])
}

test.describe('kinematics', () => {
	test('builds an STL and downloads the kinematics package', async ({ page, gotoScene }) => {
		await gotoScene('kinematics')
		await page.getByRole('button', { name: 'Add', exact: true }).click()
		await expect(page.getByRole('menuitem', { name: 'Add files' })).toBeVisible()
		await expect(page.getByRole('menuitem', { name: 'Add folder' })).toBeVisible()
		await page.keyboard.press('Escape')
		await addFiles(page, CUBE_STL)

		await expect(treeRow(page, 'root')).toBeVisible({ timeout: BUILD_TIMEOUT_MS })
		await expectUnder(page, 'root', 'cube-300mm')

		const panel = await selectTreeNode(page, 'cube-300mm')
		await expect(panel.getByLabel('Name', { exact: true })).toHaveValue('cube-300mm')

		const report = await openExportMenu(page)
		await expect(page.getByRole('status', { name: 'Viam check' })).toContainText(
			'Viam check passed',
			{ timeout: BUILD_TIMEOUT_MS }
		)
		await expect(report.getByText('cube-300mm', { exact: true })).toBeVisible({
			timeout: BUILD_TIMEOUT_MS,
		})
		await expect(report.getByText(/12 triangles/)).toBeVisible()
		await expect(report.getByText('300 × 300 × 300 mm')).toBeVisible()
		await expect(page.getByRole('alert')).toHaveCount(0)

		const download = await downloadPackage(page)
		expect(download.suggestedFilename()).toMatch(/-kinematics\.zip$/)
		await expectZipEntries(download, EXPECTED_ZIP_ENTRIES)
	})

	test('reopens an export and replaces a file', async ({ page, gotoScene }, testInfo) => {
		await gotoScene('kinematics')
		await addFiles(page, CUBE_STL)
		await expect(treeRow(page, 'root')).toBeVisible({ timeout: BUILD_TIMEOUT_MS })

		await openExportMenu(page)
		const firstDownload = await downloadPackage(page)
		const zipPath = testInfo.outputPath('cube-kinematics.zip')
		await firstDownload.saveAs(zipPath)

		await gotoScene('kinematics')
		await expect(page.getByText(/Drop STL or PLY mesh files/)).toBeVisible()
		await addFiles(page, zipPath)
		await expect(treeRow(page, 'root')).toBeVisible({ timeout: BUILD_TIMEOUT_MS })
		await expectUnder(page, 'root', 'cube-300mm')

		const panel = await selectTreeNode(page, 'cube-300mm')
		await panel.getByTestId('kinematics-source-input').setInputFiles(SPHERE_STL)

		const change = panel.getByRole('region', { name: 'Changed from the previous build' })
		await expect(change).toContainText('12 to 960', { timeout: BUILD_TIMEOUT_MS })

		const showPrevious = change.getByRole('switch', { name: 'Show previous geometry' })
		await showPrevious.click()
		await expect(showPrevious).toBeChecked()

		await openExportMenu(page)
		const secondDownload = await downloadPackage(page)
		expect(secondDownload.suggestedFilename()).toMatch(/-kinematics\.zip$/)
		await expectZipEntries(secondDownload, EXPECTED_ZIP_ENTRIES)
	})

	test('articulates a prismatic joint with a mimic and exports the model', async ({
		page,
		gotoScene,
	}) => {
		await gotoScene('kinematics')
		await addFingers(page)

		const modelName = 'root'
		await expect(treeRow(page, modelName)).toBeVisible({ timeout: BUILD_TIMEOUT_MS })
		await expectUnder(page, modelName, 'left-finger')
		await expectUnder(page, modelName, 'right-finger')

		let panel = await selectTreeNode(page, modelName)
		await panel.getByRole('button', { name: 'Add joint', exact: true }).click()
		await expect(panel.getByRole('button', { name: 'Add child joint' })).toBeVisible()
		await panel.getByLabel('Name', { exact: true }).fill('slide')
		await panel.getByLabel('Name', { exact: true }).press('Enter')
		await expectUnder(page, modelName, 'slide')

		panel = page.locator('#details-panel')
		await setSliderField(panel, 'Upper', '40')

		panel = await selectTreeNode(page, 'left-finger')
		await panel.getByRole('combobox', { name: 'Parent' }).selectOption('slide')
		await expectUnder(page, 'slide', 'left-finger')

		panel = await selectTreeNode(page, 'right-finger')
		await panel.getByRole('button', { name: 'Add joint for this link' }).click()
		await expect(panel.getByRole('button', { name: 'Add child joint' })).toBeVisible()
		await panel.getByRole('combobox', { name: 'Mimic' }).selectOption('slide')
		await expect(panel.getByRole('combobox', { name: 'Mimic' })).toHaveValue('slide')

		await selectTreeNode(page, 'right-finger')
		await expect(
			page.locator('#details-panel').getByRole('combobox', { name: 'Parent' })
		).not.toHaveValue('')

		panel = await selectTreeNode(page, 'slide')
		const position = panel.locator('[aria-label="mutable Position"] input').first()
		await expect(position).toBeVisible({ timeout: BUILD_TIMEOUT_MS })
		await expect(position).toHaveValue(/^0(\.0)? mm$/)
		await position.fill('25')
		await position.press('Enter')
		await expect(position).toHaveValue(/^25(\.0)? mm$/)
		await expect(page.getByRole('alert')).toHaveCount(0)

		await openExportMenu(page)
		const download = await downloadPackage(page)
		await expectZipEntries(download, ['kinematics.json', 'kinematics/model.json'])

		// Entries are deflated, so the joint id and mimic only show up after extraction.
		const { stdout: modelText } = await execFileAsync('unzip', [
			'-p',
			await download.path(),
			'kinematics/model.json',
		])
		expect(modelText).toContain('slide')
		expect(modelText).toContain('mimic')
	})

	test('toggles the visual and collision switches independently', async ({ page, gotoScene }) => {
		await gotoScene('kinematics')
		await addFiles(page, CUBE_STL)
		await expect(treeRow(page, 'root')).toBeVisible({ timeout: BUILD_TIMEOUT_MS })

		const visual = page.getByRole('switch', { name: 'Visual' })
		const collision = page.getByRole('switch', { name: 'Collision' })
		await expect(visual).toHaveAttribute('aria-checked', 'false')
		await expect(collision).toHaveAttribute('aria-checked', 'true')

		await visual.click()
		await expect(visual).toHaveAttribute('aria-checked', 'true')
		await expect(collision).toHaveAttribute('aria-checked', 'true')

		await collision.click()
		await expect(visual).toHaveAttribute('aria-checked', 'true')
		await expect(collision).toHaveAttribute('aria-checked', 'false')

		await visual.click()
		await expect(visual).toHaveAttribute('aria-checked', 'false')
		await expect(collision).toHaveAttribute('aria-checked', 'false')
	})

	test('shows the empty prompt and a disabled export button before a file is added', async ({
		page,
		gotoScene,
	}) => {
		await gotoScene('kinematics')

		await expect(page.getByText(/Drop STL or PLY mesh files/)).toBeVisible()
		await expect(page.getByRole('button', { name: /^Export/ })).toBeDisabled()
	})

	test('starts with a root frame and a tcp frame before any file', async ({ page, gotoScene }) => {
		await gotoScene('kinematics')

		await expectTreeNode(page, 'root')
		await expectTreeNode(page, 'tcp')
	})

	test('names the model after the added file and puts the link and tcp under root', async ({
		page,
		gotoScene,
	}) => {
		await gotoScene('kinematics')
		await addFiles(page, CUBE_STL)

		await expect(page.getByText('Building...')).toHaveCount(0, { timeout: BUILD_TIMEOUT_MS })
		await expectTreeNode(page, 'cube-300mm')
		await expectUnder(page, 'root', 'cube-300mm')
		await expectUnder(page, 'root', 'tcp')

		const panel = await selectTreeNode(page, 'root')
		await expect(panel.getByLabel('Model name')).toHaveValue('cube-300mm')
	})

	test('imports a URDF package and reports the import', async ({ page, gotoScene }) => {
		await gotoScene('kinematics')
		await page.getByTestId('kinematics-urdf-input').setInputFiles(URDF_PACKAGE)

		const summary = page.getByRole('region', { name: 'Import summary' })
		await expect(summary).toContainText('Imported', { timeout: BUILD_TIMEOUT_MS })
		await expect(page.getByText('Building...')).toHaveCount(0, { timeout: BUILD_TIMEOUT_MS })
		await expectTreeNode(page, 'tcp')

		await openExportMenu(page)
		await expect(page.getByRole('status', { name: 'Viam check' })).toContainText(
			/Viam check passed( with warnings)?/,
			{ timeout: BUILD_TIMEOUT_MS }
		)
	})

	test('drags the gizmo on a link and writes its origin on release', async ({
		page,
		gotoScene,
	}) => {
		await gotoScene('kinematics')
		await addFiles(page, CUBE_STL)
		await expect(treeRow(page, 'root')).toBeVisible({ timeout: BUILD_TIMEOUT_MS })
		await expect(page.getByText('Building...')).toHaveCount(0, { timeout: BUILD_TIMEOUT_MS })
		await enableSnapping(page)

		const panel = await selectTreeNode(page, 'cube-300mm')
		const fields = panel.locator('[aria-label="mutable Origin position"] input')
		await expect(fields.nth(0)).toHaveValue(/^0(\.0+)?$/)

		const unit = await gizmoUnit(page)
		const handle = await projectToCanvas(page, [HANDLE_CENTER_FRACTION * unit, 0, 0])
		const target = await projectToCanvas(page, [
			HANDLE_CENTER_FRACTION * unit + DRAG_DISTANCE_M,
			0,
			0,
		])

		await page.mouse.move(handle.x, handle.y)
		await page.mouse.down()
		await page.mouse.move(target.x, target.y, { steps: DRAG_STEPS })
		await page.mouse.up()

		await expect
			.poll(async () => Number.parseFloat(await fields.nth(0).inputValue()))
			.toBeGreaterThan(0)
		const x = Number.parseFloat(await fields.nth(0).inputValue())
		expect(x % SNAP_STEP_MM).toBeCloseTo(0, 6)
		await expect(fields.nth(1)).toHaveValue(/^0(\.0+)?$/)
		await expect(fields.nth(2)).toHaveValue(/^0(\.0+)?$/)
	})
})
