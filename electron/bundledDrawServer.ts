import { app } from 'electron'
import { mkdirSync } from 'node:fs'
import path from 'node:path'

import { type DrawServer, startDrawServer } from './drawServer'

const STARTUP_TIMEOUT_MS = 10_000
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
 * Starts the bundled draw server. A failure is logged and resolves `undefined`, so the app runs
 * without it, the way the browser build does with no server.
 */
export const startBundledDrawServer = async (): Promise<DrawServer | undefined> => {
	const tmpDir = path.join(app.getPath('userData'), 'draw-tmp')
	try {
		mkdirSync(tmpDir, { recursive: true })
		return await startDrawServer({
			args: ['-port', '0', '-tmp-dir', tmpDir, '-exit-on-stdin-close'],
			command: binaryPath(),
			timeoutMs: STARTUP_TIMEOUT_MS,
		})
	} catch (error) {
		console.error('failed to start draw-server:', error)
		return undefined
	}
}
