import type { Credentials, DialWebRTCConf } from '@viamrobotics/sdk'

const LAUNCH_CONFIG_VERSION = 1
export const LAUNCH_CONFIG_COMMAND = 'launch_config'
export const LAUNCH_CONFIG_EVENT = 'launch-config-changed'

const REQUIRED_STRING_FIELDS = [
	'host',
	'partId',
	'partName',
	'machineName',
	'signalingAddress',
	'serviceHost',
] as const

export interface LaunchConfig
	extends Required<Pick<DialWebRTCConf, 'host' | 'signalingAddress' | 'serviceHost'>> {
	version: typeof LAUNCH_CONFIG_VERSION
	partId: string
	partName: string
	machineName: string
	credentials: Credentials
	expiresAt?: string
}

export interface LaunchConfigPayload {
	config: unknown | null
	error: string | null
}

export const launchConfigToDialConf = (config: LaunchConfig): DialWebRTCConf => {
	return {
		host: config.host,
		credentials: config.credentials,
		signalingAddress: config.signalingAddress,
		disableSessions: true,
	}
}

export const parseLaunchConfig = (value: unknown): LaunchConfig => {
	if (!isRecord(value)) throw new Error('Launch file is not an object')

	const config: LaunchConfig = {
		version: parseVersion(value),
		credentials: parseCredentials(value.credentials),
		expiresAt: parseExpiresAt(value.expiresAt),
	} as LaunchConfig

	for (const field of REQUIRED_STRING_FIELDS) config[field] = parseField(value, field)
	return config
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
	typeof value === 'object' && value !== null && !Array.isArray(value)

const parseVersion = (value: Record<string, unknown>): typeof LAUNCH_CONFIG_VERSION => {
	if (value.version !== LAUNCH_CONFIG_VERSION) {
		throw new Error(
			`Launch file version ${String(value.version)} is not supported, expected ${LAUNCH_CONFIG_VERSION}`
		)
	}
	return value.version
}

const parseField = (value: Record<string, unknown>, field: string): string => {
	const result = value[field]
	if (!isNonEmptyString(result)) throw new Error(`Launch file field "${field}" is missing`)
	return result
}

const isNonEmptyString = (value: unknown): value is string =>
	typeof value === 'string' && value !== ''

const parseCredentials = (value: unknown): Credentials => {
	if (!isRecord(value) || !('type' in value)) {
		throw new Error('Launch file field "credentials" is missing')
	}

	const { type, payload, authEntity } = value
	if (!isNonEmptyString(payload)) {
		throw new Error('Launch file field "credentials.payload" is missing')
	}

	if (type === 'access-token') return { type, payload }
	if (type === 'api-key') {
		if (!isNonEmptyString(authEntity)) {
			throw new Error('Launch file field "credentials.authEntity" is missing')
		}
		return { type, payload, authEntity }
	}

	throw new Error(`Launch file credentials type "${String(type)}" is not supported`)
}

const parseExpiresAt = (value: unknown): string | undefined => {
	if (value === undefined) return undefined
	if (typeof value !== 'string') throw new Error('Launch file field "expiresAt" must be a string')
	return value
}
