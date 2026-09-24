import fs from 'node:fs'
import path from 'node:path'
import url from 'node:url'

const dirname = path.dirname(url.fileURLToPath(import.meta.url))

/**
 * Describes the machine the `robot-setup` project provisioned, for the robot
 * specs and for `robot-teardown`.
 *
 * Provisioning runs as its own project, and projects run in their own worker
 * processes, so `process.env` writes made during setup are invisible to the
 * workers that run the tests. The handoff has to go through the filesystem.
 *
 * Every field past `robotId` is optional because setup writes the file the moment
 * the machine exists and rewrites it as provisioning proceeds. A run that dies
 * halfway still leaves teardown enough to delete the machine instead of leaking it.
 */
export interface MachineState {
	robotId: string
	partId?: string
	machineName?: string
	host?: string
	apiKeyId?: string
	apiKey?: string
	signalingAddress?: string
	orgId?: string
	viamServerPid?: number
}

export const machineStatePath = path.resolve(dirname, '../.bin/machine.json')

export const viamServerLogPath = path.resolve(dirname, '../.bin/viam-server.log')

export const viamServerConfigPath = path.resolve(dirname, '../.bin/viam-e2e.json')

export const writeMachineState = (state: MachineState): void => {
	fs.mkdirSync(path.dirname(machineStatePath), { recursive: true })
	// 0600 because the file carries a raw machine API key.
	fs.writeFileSync(machineStatePath, JSON.stringify(state, undefined, 2), { mode: 0o600 })
}

export const readMachineState = (): MachineState | undefined => {
	if (!fs.existsSync(machineStatePath)) return undefined
	return JSON.parse(fs.readFileSync(machineStatePath, 'utf8')) as MachineState
}

export const clearMachineState = (): void => {
	fs.rmSync(machineStatePath, { force: true })
}
