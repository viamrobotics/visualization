import {
	createViamClient,
	Struct,
	type ViamClient,
	type ViamClientOptions,
} from '@viamrobotics/sdk'
import { type ChildProcess, execSync, spawn } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import url from 'node:url'

import { loadE2EConfig } from './e2e-config'

const dirname = path.dirname(url.fileURLToPath(import.meta.url))

let serverProcess: ChildProcess | undefined
let viamClient: ViamClient | undefined
let createdRobotId: string | undefined

const E2E_ORG_NAME = 'Viam Viz E2E'
const E2E_LOCATION_NAME = 'e2e-tests'
const VIAM_SERVER_PORT = 9090

const connectAppClient = async (apiKeyId: string, apiKey: string): Promise<ViamClient> => {
	const opts: ViamClientOptions = {
		serviceHost: 'https://app.viam.com:443',
		credentials: {
			type: 'api-key',
			authEntity: apiKeyId,
			payload: apiKey,
		},
	}
	return createViamClient(opts)
}

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
					console.log(`   Machine is online (last access ${Math.round(ageMs / 1000)}s ago)`)
					return
				}
			}
		} catch {
			// not ready yet
		}
		if (i % 5 === 0 && i > 0) {
			console.log(`   Still waiting for machine to come online... (${i * 2}s)`)
		}
		await new Promise((resolve) => {
			setTimeout(resolve, 2000)
		})
	}
	throw new Error(`Machine failed to come online within ${maxAttempts * 2} seconds`)
}

export const setup = async (): Promise<() => Promise<void>> => {
	const binaryPath = path.resolve(dirname, '../.bin/viam-server')
	if (!fs.existsSync(binaryPath)) {
		throw new Error(
			`viam-server binary not found at ${binaryPath}.\n` +
				`Run 'cd e2e && ./setup.sh' to install it.`
		)
	}

	const config = loadE2EConfig()

	console.log('Connecting to Viam cloud...')
	viamClient = await connectAppClient(config.apiKeyId, config.apiKey)
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
	console.log(`   Found org: ${orgId}`)

	console.log(`Finding or creating location "${E2E_LOCATION_NAME}"...`)
	const locations = await viamClient.appClient.listLocations(orgId)
	let location = locations.find((loc) => loc.name === E2E_LOCATION_NAME)
	if (location) {
		console.log(`   Found location: ${location.id}`)
	} else {
		location = await viamClient.appClient.createLocation(orgId, E2E_LOCATION_NAME)
		console.log(`   Created location: ${location?.id}`)
	}

	const username = os.userInfo().username || 'unknown'
	const machineName = `e2e-${username}-${Date.now()}`
	console.log(`Creating machine "${machineName}"...`)
	const robotId = await viamClient.appClient.newRobot(location?.id ?? '', machineName)
	createdRobotId = robotId
	console.log(`   Created machine: ${robotId}`)

	console.log('Getting machine parts...')
	const parts = await viamClient.appClient.getRobotParts(robotId)
	if (parts.length === 0) {
		throw new Error('Machine has no parts')
	}
	const part = parts[0]!
	const partId = part.id
	console.log(`   Part ID: ${partId}`)

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
	console.log(`   FQDN: ${fqdn}`)

	console.log('Creating machine API key...')
	const cliOutput = execSync(
		`viam machines api-key create --machine-id=${robotId} --org-id=${orgId} --name=e2e-${machineName}`,
		{ encoding: 'utf8' }
	)
	const keyIdMatch = cliOutput.match(/Key ID:\s*(.+)/i)
	const keyValueMatch = cliOutput.match(/Key Value:\s*(.+)/i)
	if (!keyIdMatch || !keyValueMatch) {
		throw new Error(`Failed to parse API key from CLI output:\n${cliOutput}`)
	}
	const machineApiKeyId = keyIdMatch[1]!.trim()
	const machineApiKey = keyValueMatch[1]!.trim()
	console.log(`   Machine API key created: ${machineApiKeyId}`)

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

	const credentialsPath = path.resolve(dirname, '../.bin/viam-e2e.json')
	console.log(`Writing viam-server credentials to ${credentialsPath}...`)
	const viamServerConfig = {
		cloud: {
			id: partId,
			secret: partSecret,
			app_address: 'https://app.viam.com:443',
		},
	}
	fs.writeFileSync(credentialsPath, JSON.stringify(viamServerConfig, null, 2))

	console.log('Starting viam-server...')
	serverProcess = spawn(binaryPath, ['-config', credentialsPath], {
		stdio: ['ignore', 'pipe', 'pipe'],
		detached: false,
	})

	serverProcess.stdout?.on('data', (data: Buffer) => {
		const text = data.toString().trim()
		if (text) console.log(`[viam-server]: ${text}`)
	})

	serverProcess.stderr?.on('data', (data: Buffer) => {
		const text = data.toString().trim()
		if (text) console.error(`[viam-server ERROR]: ${text}`)
	})

	serverProcess.on('error', (error) => {
		console.error('Failed to start viam-server:', error)
		throw error
	})

	serverProcess.on('exit', (code, signal) => {
		if (code !== 0 && code !== null) {
			console.error(`viam-server exited with code ${code}`)
		}
		if (signal) {
			console.log(`viam-server killed with signal ${signal}`)
		}
	})

	console.log('Waiting for machine to come online...')
	await waitForMachineOnline(viamClient, partId)

	const signalingAddress = 'https://app.viam.com:443'

	// Derive the machine-level FQDN (without part suffix) to match signaling registration.
	// Part FQDN: "e2e-devin-123-main.location.viam.cloud"
	// Signaling host: "e2e-devin-123.location.viam.cloud"
	const locationSuffix = fqdn.slice(fqdn.indexOf('.'))
	const signalingHost = `${machineName}${locationSuffix}`
	console.log(`   Signaling host: ${signalingHost}`)

	process.env.VIAM_E2E_HOST = signalingHost
	process.env.VIAM_E2E_PART_ID = partId
	process.env.VIAM_E2E_MACHINE_NAME = machineName
	process.env.VIAM_E2E_ROBOT_ID = robotId
	process.env.VIAM_E2E_API_KEY_ID = machineApiKeyId
	process.env.VIAM_E2E_API_KEY = machineApiKey
	process.env.VIAM_E2E_ORG_ID = orgId
	process.env.VIAM_E2E_SIGNALING_ADDRESS = signalingAddress
	process.env.VIAM_E2E_ORG_API_KEY_ID = config.apiKeyId
	process.env.VIAM_E2E_ORG_API_KEY = config.apiKey

	console.log('\n=== E2E Global Setup Complete ===\n')

	return teardown
}

export const teardown = async (): Promise<void> => {
	if (serverProcess) {
		console.log('Stopping viam-server...')
		const exitPromise = new Promise<void>((resolve) => {
			if (!serverProcess) {
				resolve()
				return
			}

			const timeout = setTimeout(() => {
				console.warn('   viam-server did not exit gracefully, forcing kill...')
				serverProcess?.kill('SIGKILL')
				resolve()
			}, 5000)

			serverProcess.on('exit', () => {
				clearTimeout(timeout)
				serverProcess = undefined
				resolve()
			})
		})

		serverProcess.kill('SIGTERM')
		await exitPromise
		console.log('   viam-server stopped.')
	}

	if (viamClient && createdRobotId) {
		console.log(`Deleting machine ${createdRobotId}...`)
		try {
			await viamClient.appClient.deleteRobot(createdRobotId)
			console.log('   Machine deleted.')
		} catch (error) {
			console.warn('   Failed to delete machine:', error)
		}
	}

	const credentialsPath = path.resolve(dirname, '../.bin/viam-e2e.json')
	if (fs.existsSync(credentialsPath)) {
		console.log('Cleaning up credentials file...')
		fs.unlinkSync(credentialsPath)
	}

	viamClient = undefined

	console.log('\nGlobal Teardown Complete\n')
}

export default setup
