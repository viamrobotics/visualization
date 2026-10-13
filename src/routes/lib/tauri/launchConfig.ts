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
	'credentials',
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
	if (value.version !== LAUNCH_CONFIG_VERSION) throw new LaunchConfigVersionError(value.version)

	const config: LaunchConfig = {} as LaunchConfig
	for (const field of REQUIRED_STRING_FIELDS) {
		if (!value[field]) throw new LaunchConfigFieldError(field)
		if (field === 'credentials') {
			const credentials = parseCredentials(config.credentials)
			if (config.expiresAt !== undefined && typeof config.expiresAt !== 'string') {
				throw new LaunchConfigExpiryError()
			}

			config.credentials = credentials
			continue
		}

		config[field] = value[field] as string
	}

	return config
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
	typeof value === 'object' && value !== null && !Array.isArray(value)

const isCredentials = (value: unknown): value is ConfigCredientials =>
	isRecord(value) && 'type' in value && 'payload' in value

const isAccessToken = (value: ConfigCredientials): value is LaunchAccessToken =>
	value.type === 'access-token'

const isApiKey = (value: ConfigCredientials): value is LaunchApiKey => value.type === 'api-key'

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
