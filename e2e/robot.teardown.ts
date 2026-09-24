import { test as teardown } from '@playwright/test'
import fs from 'node:fs'

import { connectAppClient } from './helpers/appClient'
import { loadE2EConfig } from './helpers/e2e-config'
import { clearMachineState, readMachineState, viamServerConfigPath } from './helpers/machineState'

/**
 * viam-server was spawned detached, so it is not a child of this worker and
 * cannot be awaited. Signal its process group, then poll with signal 0 until it
 * is gone before escalating.
 */
const stopViamServer = async (pid: number): Promise<void> => {
	// The group, not just the pid, so anything viam-server spawned goes with it.
	const signal = (sig: NodeJS.Signals | 0): boolean => {
		try {
			process.kill(-pid, sig)
			return true
		} catch {
			try {
				process.kill(pid, sig)
				return true
			} catch {
				return false
			}
		}
	}

	if (!signal(0)) {
		console.log('   viam-server was already gone.')
		return
	}

	console.log('Stopping viam-server...')
	signal('SIGTERM')

	for (let attempt = 0; attempt < 25; attempt += 1) {
		await new Promise((resolve) => {
			setTimeout(resolve, 200)
		})
		if (!signal(0)) {
			console.log('   viam-server stopped.')
			return
		}
	}

	console.warn('   viam-server did not exit gracefully, forcing kill...')
	signal('SIGKILL')
}

teardown('deprovision machine', async () => {
	const state = readMachineState()

	if (!state) {
		console.log('No machine state on disk, nothing to tear down.')
		return
	}

	if (state.viamServerPid !== undefined) {
		await stopViamServer(state.viamServerPid)
	}

	console.log('Deleting machine...')
	try {
		// Org credentials rather than the machine key, which is about to be deleted
		// along with the machine it belongs to.
		const config = loadE2EConfig()
		const viamClient = await connectAppClient(config.apiKeyId, config.apiKey)
		await viamClient.appClient.deleteRobot(state.robotId)
		console.log('   Machine deleted.')
	} catch (error) {
		console.warn(`   Failed to delete machine ${state.robotId}:`, error)
		console.warn('   Delete it by hand to avoid leaving it running in the cloud.')
	}

	fs.rmSync(viamServerConfigPath, { force: true })
	clearMachineState()

	console.log('\nRobot teardown complete\n')
})
