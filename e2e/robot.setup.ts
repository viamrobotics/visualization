import { test as setup } from '@playwright/test'
import { Struct, type ViamClient } from '@viamrobotics/sdk'
import { execSync, spawn } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import url from 'node:url'

import { APP_ADDRESS, connectAppClient } from './helpers/appClient'
import { loadE2EConfig } from './helpers/e2e-config'
import {
	type MachineState,
	machineStatePath,
	viamServerConfigPath,
	viamServerLogPath,
	writeMachineState,
} from './helpers/machineState'

const dirname = path.dirname(url.fileURLToPath(import.meta.url))

const E2E_ORG_NAME = 'Viam Viz E2E'
const E2E_LOCATION_NAME = 'e2e-tests'
const VIAM_SERVER_PORT = 9090

const waitForMachineOnline = async (
	client: ViamClient,
	partId: string,
	maxAttempts = 60
): Promise<void> => {
	const onlineThresholdMs = 15_000

	for (let i = 0; i < maxAttempts; i += 1) {
		try {
			const resp = await client.appClient.getRobotPart(partId)
			const lastAccess = resp.part?.lastAccess
			if (lastAccess) {
				const lastAccessMs = Number(lastAccess.seconds) * 1000
				const ageMs = Date.now() - lastAccessMs
				if (ageMs < onlineThresholdMs) {
					console.log(`   Machine is online`)
					return
				}
			}
		} catch {
			// A failed probe means the machine is not up yet, so keep polling.
		}
		if (i % 5 === 0 && i > 0) {
			console.log(`   Still waiting for machine to come online... (${i * 2}s)`)
		}
		await new Promise((resolve) => {
			setTimeout(resolve, 2000)
		})
	}
	throw new Error(
		`Machine failed to come online within ${maxAttempts * 2} seconds.\n` +
			`Check ${viamServerLogPath} for what viam-server reported.`
	)
}

/**
 * viam-server has to outlive this worker, which exits as soon as the setup test
 * finishes, so it is spawned detached with its output redirected to a file
 * rather than piped back to a parent that will be gone. `robot-teardown` kills
 * it by the recorded pid.
 */
const startViamServer = (partId: string, partSecret: string): number => {
	const binaryPath = path.resolve(dirname, './.bin/viam-server')

	fs.writeFileSync(
		viamServerConfigPath,
		JSON.stringify(
			{
				cloud: {
					id: partId,
					secret: partSecret,
					app_address: APP_ADDRESS,
				},
			},
			undefined,
			2
		),
		{ mode: 0o600 }
	)

	const logFd = fs.openSync(viamServerLogPath, 'w')
	const serverProcess = spawn(binaryPath, ['-config', viamServerConfigPath], {
		stdio: ['ignore', logFd, logFd],
		detached: true,
	})
	fs.closeSync(logFd)

	serverProcess.on('error', (error) => {
		console.error('Failed to start viam-server:', error)
	})

	const { pid } = serverProcess
	if (pid === undefined) {
		throw new Error(`Failed to spawn viam-server from ${binaryPath}`)
	}

	serverProcess.unref()

	return pid
}

setup('provision machine', async () => {
	const binaryPath = path.resolve(dirname, './.bin/viam-server')
	if (!fs.existsSync(binaryPath)) {
		throw new Error(
			`viam-server binary not found at ${binaryPath}.\n` +
				`Run './e2e/setup.sh' to install it, or 'pnpm e2e:robot' which runs it for you.`
		)
	}

	const config = loadE2EConfig()

	console.log('Connecting to Viam cloud...')
	const viamClient = await connectAppClient(config.apiKeyId, config.apiKey)
	console.log('   Connected.')

	console.log(`Finding "${E2E_ORG_NAME}" organization...`)
	const orgs = await viamClient.appClient.listOrganizations()
	const e2eOrg = orgs.find((org) => org.name === E2E_ORG_NAME)
	if (!e2eOrg) {
		throw new Error(
			`Organization "${E2E_ORG_NAME}" not found.\n` +
				`Create it with: viam organizations create --name "${E2E_ORG_NAME}"\n` +
				`Then re-run the tests.`
		)
	}
	const orgId = e2eOrg.id
	console.log('   Found org.')

	console.log(`Finding or creating location "${E2E_LOCATION_NAME}"...`)
	const locations = await viamClient.appClient.listLocations(orgId)
	let location = locations.find((loc) => loc.name === E2E_LOCATION_NAME)
	if (location) {
		console.log('   Found location.')
	} else {
		location = await viamClient.appClient.createLocation(orgId, E2E_LOCATION_NAME)
		console.log('   Created location.')
	}

	const username = os.userInfo().username || 'unknown'
	const machineName = `e2e-${username}-${Date.now()}`
	console.log(`Creating machine "${machineName}"...`)
	const robotId = await viamClient.appClient.newRobot(location?.id ?? '', machineName)
	console.log('   Created machine.')

	// Recorded before anything else can fail, so teardown deletes the machine
	// even when provisioning dies partway through.
	const state: MachineState = { robotId, machineName, orgId, signalingAddress: APP_ADDRESS }
	writeMachineState(state)

	console.log('Getting machine parts...')
	const parts = await viamClient.appClient.getRobotParts(robotId)
	if (parts.length === 0) {
		throw new Error('Machine has no parts')
	}
	const part = parts[0]!
	const partId = part.id
	state.partId = partId
	writeMachineState(state)
	console.log('   Got part.')

	console.log('Creating part secret...')
	const partWithSecret = await viamClient.appClient.createRobotPartSecret(partId)
	const secrets = partWithSecret?.secret ?? partWithSecret?.secrets
	let partSecret: string | undefined

	if (typeof secrets === 'string') {
		partSecret = secrets
	} else if (Array.isArray(secrets) && secrets.length > 0) {
		partSecret = secrets.at(-1)?.secret
	}

	if (!partSecret) {
		throw new Error('Failed to retrieve part secret')
	}
	console.log('   Part secret created.')

	console.log('Getting machine FQDN...')
	const partResponse = await viamClient.appClient.getRobotPart(partId)
	const fqdn = partResponse.part?.fqdn
	if (!fqdn) {
		throw new Error('Machine part has no FQDN')
	}
	console.log('   Got FQDN.')

	console.log('Creating machine API key...')
	// NOTE: cliOutput contains the raw machine API key value and must never be logged.
	const cliOutput = execSync(
		`viam machines api-key create --machine-id=${robotId} --org-id=${orgId} --name=e2e-${machineName}`,
		{ encoding: 'utf8' }
	)
	const keyIdMatch = cliOutput.match(/Key ID:\s*(.+)/i)
	const keyValueMatch = cliOutput.match(/Key Value:\s*(.+)/i)
	if (!keyIdMatch || !keyValueMatch) {
		throw new Error('Failed to parse API key from Viam CLI output.')
	}
	state.apiKeyId = keyIdMatch[1]!.trim()
	state.apiKey = keyValueMatch[1]!.trim()
	writeMachineState(state)
	console.log('   Machine API key created.')

	console.log(`Pushing initial config (bind_address :${VIAM_SERVER_PORT})...`)
	await viamClient.appClient.updateRobotPart(
		partId,
		machineName,
		Struct.fromJson({
			network: {
				bind_address: `:${VIAM_SERVER_PORT}`,
			},
		})
	)
	console.log('   Config pushed.')

	console.log(`Starting viam-server (logging to ${viamServerLogPath})...`)
	state.viamServerPid = startViamServer(partId, partSecret)
	writeMachineState(state)
	console.log(`   Started as pid ${state.viamServerPid}.`)

	console.log('Waiting for machine to come online...')
	await waitForMachineOnline(viamClient, partId)

	// Derive the machine-level FQDN (without part suffix) to match signaling registration.
	// Part FQDN: "e2e-devin-123-main.location.viam.cloud"
	// Signaling host: "e2e-devin-123.location.viam.cloud"
	state.host = `${machineName}${fqdn.slice(fqdn.indexOf('.'))}`
	writeMachineState(state)

	console.log(`\nRobot setup complete, state in ${machineStatePath}\n`)
})
