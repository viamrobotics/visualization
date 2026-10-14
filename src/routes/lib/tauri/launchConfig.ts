import type { DialWebRTCConf } from '@viamrobotics/sdk'

import {
	LaunchConfigError,
	LaunchConfigExpiryError,
	LaunchConfigFieldError,
	LaunchConfigVersionError,
} from './configErrors'

export const LAUNCH_CONFIG_VERSION = 1
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

interface ConfigCredientials {
	type: string
	payload: string
	authEntity?: string
}

export interface LaunchAccessToken {
	type: 'access-token'
	payload: string
}

export interface LaunchApiKey {
	type: 'api-key'
	authEntity: string
	payload: string
}

export type LaunchCredentials = LaunchAccessToken | LaunchApiKey

export interface LaunchConfig {
	version: typeof LAUNCH_CONFIG_VERSION
	host: string
	partId: string
	partName: string
	machineName: string
	signalingAddress: string
	serviceHost: string
	credentials: LaunchCredentials
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
	if (!isRecord(value)) throw new LaunchConfigError()

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

const isCredentials = (value: unknown): value is ConfigCredientials =>
	isRecord(value) && 'type' in value

const isAccessToken = (value: ConfigCredientials): value is LaunchAccessToken =>
	value.type === 'access-token'

const isApiKey = (value: ConfigCredientials): value is LaunchApiKey => value.type === 'api-key'

const parseVersion = (value: Record<string, unknown>): typeof LAUNCH_CONFIG_VERSION => {
	if (value.version !== LAUNCH_CONFIG_VERSION) throw new LaunchConfigVersionError(value.version)
	return value.version
}

const parseField = (value: Record<string, unknown>, field: string): string => {
	if (!(field in value)) throw new LaunchConfigFieldError(field)

	const result = value[field]
	if (typeof result !== 'string' || result === '') throw new LaunchConfigFieldError(field)
	return result
}

const parseCredentials = (value: unknown): LaunchCredentials => {
	if (!isCredentials(value)) throw new Error('Launch file field "credentials" is missing')
	if (!value.payload) throw new Error('Launch file field "credentials.payload" is missing')
	if (isAccessToken(value)) return value
	if (isApiKey(value)) {
		if (!value.authEntity) throw new Error('Launch file field "credentials.authEntity" is missing')
		return value
	}

	throw new Error(`Launch file credentials type "${String(value.type)}" is not supported`)
}

const parseExpiresAt = (value: unknown): string | undefined => {
	if (value === undefined) return undefined
	if (typeof value !== 'string') throw new LaunchConfigExpiryError()
	return value
}
