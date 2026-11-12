import { spawn } from 'node:child_process'
import { createInterface } from 'node:readline'

import { parsePortLine } from './drawServerPort'

const LOG_PREFIX = 'draw-server:'

/** A running draw server. */
export interface DrawServer {
	/** The bound port, or `undefined` once the process has exited. */
	readonly port: number | undefined
	/** Kills the process. Safe to call more than once. */
	stop(): void
}

interface StartOptions {
	command: string
	args: readonly string[]
	/** How long to wait for the port line before killing the process. */
	timeoutMs: number
}

/**
 * Spawns the draw server and resolves once it prints its port line. stdin stays piped and open,
 * so a server started with `-exit-on-stdin-close` exits when this process dies without cleanup.
 *
 * @throws When the process fails to spawn, exits, or stays silent past `timeoutMs` first. On a
 *   timeout the process is killed.
 */
export const startDrawServer = ({ command, args, timeoutMs }: StartOptions): Promise<DrawServer> =>
	new Promise((resolve, reject) => {
		const child = spawn(command, args, { stdio: ['pipe', 'pipe', 'pipe'] })
		let port: number | undefined
		let isSettled = false

		const server: DrawServer = {
			get port() {
				return port
			},
			stop: () => {
				child.kill()
			},
		}

		const settle = (outcome: () => void) => {
			if (isSettled) return
			isSettled = true
			clearTimeout(timer)
			outcome()
		}

		const timer = setTimeout(() => {
			child.kill()
			settle(() => reject(new Error('draw-server did not report a port in time')))
		}, timeoutMs)

		createInterface({ input: child.stdout }).on('line', (line) => {
			const parsed = isSettled ? undefined : parsePortLine(line)
			if (parsed === undefined) {
				console.log(LOG_PREFIX, line)
				return
			}
			port = parsed
			settle(() => resolve(server))
		})

		createInterface({ input: child.stderr }).on('line', (line) => {
			console.log(LOG_PREFIX, line)
		})

		child.on('error', (error) => {
			settle(() => reject(error))
		})

		child.on('exit', (code, signal) => {
			console.warn(`${LOG_PREFIX} exited with ${signal ?? `code ${code}`}`)
			port = undefined
			settle(() => reject(new Error(`draw-server exited before reporting a port`)))
		})
	})
