import { app } from 'electron'
import { mkdirSync } from 'node:fs'
import path from 'node:path'

import { type DrawServer, startDrawServer } from './drawServer'
import { isPortFree } from './isPortFree'

const STARTUP_TIMEOUT_MS = 10_000
/** The port `client/api` callers reach with no configuration. Mirrors `server.DefaultPort` in Go. */
const DEFAULT_DRAW_SERVICE_PORT = 3030
/** Tells draw-server to bind any free port. */
const ANY_FREE_PORT = 0
const BINARY_NAME = process.platform === 'win32' ? 'draw-server.exe' : 'draw-server'

// Packaged builds carry the binary in resources. Unpackaged runs use `pnpm build:sidecar` output.
const binaryPath = () =>
	app.isPackaged
		? path.join(process.resourcesPath, BINARY_NAME)
		: path.join(import.meta.dirname, '..', 'dist-sidecar', BINARY_NAME)

/**
 * Whether this run starts the bundled draw server. An unpackaged run already gets one from
 * `pnpm dev`, so it opts in with `VIAM_VISUALIZER_SIDECAR`.
 */
export const shouldStartDrawServer = () =>
	app.isPackaged || process.env.VIAM_VISUALIZER_SIDECAR !== undefined

/**
 * Starts the bundled draw server on {@link DEFAULT_DRAW_SERVICE_PORT}, or on a free port when that
 * one is taken. A failure is logged and resolves `undefined`, so the app runs without it, the way
 * the browser build does with no server.
 */
export const startBundledDrawServer = async (): Promise<DrawServer | undefined> => {
	const tmpDir = path.join(app.getPath('userData'), 'draw-tmp')
	try {
		mkdirSync(tmpDir, { recursive: true })
		// Checked here because draw-server attaches to whatever already holds its port instead of failing.
		const isDefaultPortFree = await isPortFree(DEFAULT_DRAW_SERVICE_PORT)
		const port = isDefaultPortFree ? DEFAULT_DRAW_SERVICE_PORT : ANY_FREE_PORT
		const server = await startDrawServer({
			args: ['-port', String(port), '-tmp-dir', tmpDir, '-exit-on-stdin-close'],
			command: binaryPath(),
			timeoutMs: STARTUP_TIMEOUT_MS,
		})
		if (!isDefaultPortFree) {
			console.warn(
				`draw-server: :${DEFAULT_DRAW_SERVICE_PORT} is taken, so it runs on :${server.port}. Set DRAW_SERVICE_PORT=${server.port} for client/api.`
			)
		}
		return server
	} catch (error) {
		console.error('failed to start draw-server:', error)
		return undefined
	}
}
