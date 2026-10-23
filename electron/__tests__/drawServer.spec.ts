import { beforeEach, describe, expect, it, vi } from 'vitest'

import { startDrawServer } from '../drawServer'

/** Starts a Node process standing in for draw-server, running `script`. */
const startFake = (script: string, timeoutMs: number) =>
	startDrawServer({ command: process.execPath, args: ['-e', script], timeoutMs })

beforeEach(() => {
	vi.spyOn(console, 'warn').mockImplementation(() => {})
})

describe('startDrawServer', () => {
	it('fails instead of hanging when the server never prints its port', async () => {
		await expect(startFake('process.stdin.resume()', 200)).rejects.toThrow(
			'draw-server did not report a port in time'
		)
	})

	it('fails when the server exits before printing its port', async () => {
		await expect(startFake('process.exit(3)', 2000)).rejects.toThrow(
			'draw-server exited before reporting a port'
		)
	})
})
