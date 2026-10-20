import { test as base, expect } from '@playwright/test'
import { type ChildProcess, execFile, execFileSync, spawn } from 'node:child_process'
import fs from 'node:fs'
import net from 'node:net'
import os from 'node:os'
import path from 'node:path'
import url from 'node:url'
import { promisify } from 'node:util'

import { createDrawClient, type DrawClient, resetScene } from '../helpers/drawClient'
import { dropFileOnPage, type DroppedFile } from '../helpers/dropFile'
import { screenshotCanvas } from '../helpers/screenshot'

const execFileAsync = promisify(execFile)

const dirname = path.dirname(url.fileURLToPath(import.meta.url))

const drawScenesBinary = path.resolve(dirname, '../../.bin/draw-scenes')
const sceneDataDir = path.resolve(dirname, '../../client/data')

/** Avoids 3000, 3030, 5173, 9090, and the 191xx range Go's own test servers use. */
const BASE_PORT = 4100

const CONNECT_PROBE_TIMEOUT_MS = 500

const isListening = (port: number): Promise<boolean> =>
	new Promise((resolve) => {
		const socket = net.connect({ port, host: '127.0.0.1' })
		const settle = (listening: boolean) => {
			socket.destroy()
			resolve(listening)
		}
		socket.once('connect', () => settle(true))
		socket.once('error', () => settle(false))
		socket.setTimeout(CONNECT_PROBE_TIMEOUT_MS, () => settle(false))
	})

const waitForListening = async (port: number, timeoutMs = 15_000): Promise<void> => {
	const deadline = Date.now() + timeoutMs
	while (Date.now() < deadline) {
		if (await isListening(port)) return
		await new Promise((resolve) => {
			setTimeout(resolve, 50)
		})
	}
	throw new Error(`draw server never started listening on ${port}`)
}

/**
 * A relative URL, so a baseURL carrying a path resolves against it instead of
 * jumping to the host root. `drawPort` points the app at this worker's server.
 */
const sceneUrl = (port: number, routePath = ''): string =>
	`${routePath ? `/${routePath}` : ''}?drawPort=${port}`

const sceneArgs = (name: string, port: number): string[] => [
	'-port',
	String(port),
	'-data',
	sceneDataDir,
	name,
]

/** Runs a scene and waits for it to finish. */
export type DrawScene = (name: string) => void

/** Starts a scene and resolves when it exits, for scenes the spec asserts against mid-flight. */
export type DrawSceneAsync = (name: string) => Promise<unknown>

interface DrawServer {
	port: number
}

interface DrawingFixtures {
	drawClient: DrawClient
	dropFile: (file: DroppedFile) => Promise<void>
	drawScene: DrawScene
	drawSceneAsync: DrawSceneAsync
	gotoScene: (routePath: string) => Promise<void>
	resetScene: () => Promise<void>
	snapshotAndReset: (testPrefix: string) => Promise<void>
	takeScreenshot: (testPrefix: string) => Promise<void>
}

interface DrawingWorkerFixtures {
	drawServer: DrawServer
}

const requireDrawScenesBinary = () => {
	if (fs.existsSync(drawScenesBinary)) return
	throw new Error(`draw-scenes binary not found at ${drawScenesBinary}. Run 'pnpm go-build'.`)
}

/**
 * Drives the scene against a draw server this worker owns, so the drawing specs
 * can run in parallel without seeing each other's entities.
 */
export const test = base.extend<DrawingFixtures, DrawingWorkerFixtures>({
	drawServer: [
		// Playwright requires the destructuring pattern here, empty or not.
		// eslint-disable-next-line no-empty-pattern
		async ({}, use, workerInfo) => {
			// parallelIndex, not workerIndex: a worker that crashes and restarts gets a
			// fresh workerIndex, which would move its server to a port the old process
			// might still hold.
			const port = BASE_PORT + workerInfo.parallelIndex

			// server.Start attaches to an existing listener rather than failing, so a
			// stale process here would be silently shared instead of reported.
			if (await isListening(port)) {
				throw new Error(
					`port ${port} is already in use, so worker ${workerInfo.parallelIndex} ` +
						`cannot own a draw server. Kill whatever is listening and re-run.`
				)
			}

			const binary = path.resolve(dirname, '../../.bin/draw-server')
			if (!fs.existsSync(binary)) {
				throw new Error(`draw-server binary not found at ${binary}. Run 'pnpm go-build'.`)
			}

			// Its own temp dir per worker. NewDrawService empties the directory it is
			// given at startup, and workers start at different times, so a shared one
			// would delete another worker's in-flight chunk buffers.
			const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), `draw-server-${port}-`))
			const logPath = path.join(tempDir, 'draw-server.log')
			const logFd = fs.openSync(logPath, 'w')

			const server: ChildProcess = spawn(
				binary,
				['-port', String(port), '-tmp-dir', path.join(tempDir, 'chunks')],
				{ stdio: ['ignore', logFd, logFd] }
			)
			fs.closeSync(logFd)

			const exited = new Promise<void>((resolve) => {
				server.once('exit', () => resolve())
			})

			try {
				await waitForListening(port)
			} catch (error) {
				const log = fs.readFileSync(logPath, 'utf8')
				throw new Error(`${(error as Error).message}. Log: ${log}`, { cause: error })
			}

			await use({ port })

			server.kill('SIGTERM')
			await exited
			fs.rmSync(tempDir, { recursive: true, force: true })
		},
		{ scope: 'worker' },
	],

	page: async ({ page, drawServer }, use) => {
		if (process.env.E2E_DEBUG) {
			page.on('console', (message) => {
				console.log(`[${message.type()}] ${message.text()}`)
			})
		}

		await page.goto(sceneUrl(drawServer.port))
		await expect(page.getByRole('heading', { name: 'World', exact: true })).toBeVisible({
			timeout: 15_000,
		})

		await use(page)
	},

	gotoScene: async ({ page, drawServer }, use) => {
		await use(async (routePath: string) => {
			await page.goto(sceneUrl(drawServer.port, routePath))
			await page.waitForLoadState('load')
		})
	},

	drawClient: async ({ drawServer }, use) => {
		await use(createDrawClient(drawServer.port))
	},

	drawScene: async ({ drawServer }, use) => {
		requireDrawScenesBinary()
		// stdio piped rather than inherited: the binary logs a line about
		// attaching on every run, which would bury the reporter output. On a
		// failure execFileSync throws with both streams attached.
		await use((name: string) => {
			execFileSync(drawScenesBinary, sceneArgs(name, drawServer.port), { stdio: 'pipe' })
		})
	},

	drawSceneAsync: async ({ drawServer }, use) => {
		requireDrawScenesBinary()
		await use((name: string) => execFileAsync(drawScenesBinary, sceneArgs(name, drawServer.port)))
	},

	resetScene: async ({ page, drawClient }, use) => {
		await use(() => resetScene(drawClient, page))
	},

	snapshotAndReset: async ({ page, drawClient }, use) => {
		await use(async (testPrefix: string) => {
			await screenshotCanvas(page, testPrefix)
			await resetScene(drawClient, page)
		})
	},

	takeScreenshot: async ({ page }, use) => {
		await use((testPrefix: string) =>
			expect.soft(page).toHaveScreenshot(`${testPrefix}.png`, { fullPage: true })
		)
	},

	dropFile: async ({ page }, use) => {
		await use((file: DroppedFile) => dropFileOnPage(page, file))
	},
})

export { expect, type Page } from '@playwright/test'
export type { DroppedFile } from '../helpers/dropFile'
