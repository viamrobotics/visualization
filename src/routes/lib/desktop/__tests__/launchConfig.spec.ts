import type { Credentials } from '@viamrobotics/sdk'

import { describe, expect, it } from 'vitest'

import type { LaunchConfig } from '../launchConfig'

import { launchConfigToDialConf, parseLaunchConfig } from '../launchConfig'

const buildConfig = (credentials: Credentials): LaunchConfig => ({
	version: 1,
	host: 'part.local.viam.cloud',
	partId: 'part-1',
	partName: 'main',
	machineName: 'arm-rig',
	signalingAddress: 'https://app.viam.com:443',
	serviceHost: 'https://app.viam.com',
	credentials,
})

const accessTokenConfig = () => ({
	version: 1,
	host: 'part.local.viam.cloud',
	partId: 'part-1',
	partName: 'main',
	machineName: 'arm-rig',
	signalingAddress: 'https://app.viam.com:443',
	serviceHost: 'https://app.viam.com',
	credentials: { type: 'access-token', payload: 'token-abc' },
})

describe('launchConfigToDialConf', () => {
	it('maps an access-token config with sessions disabled', () => {
		const credentials: Credentials = { type: 'access-token', payload: 'tok' }

		expect(launchConfigToDialConf(buildConfig(credentials))).toEqual({
			host: 'part.local.viam.cloud',
			credentials,
			signalingAddress: 'https://app.viam.com:443',
			disableSessions: true,
		})
	})

	it('maps an api-key config with sessions disabled', () => {
		const credentials: Credentials = {
			type: 'api-key',
			payload: 'secret',
			authEntity: 'key-id',
		}

		const dialConf = launchConfigToDialConf(buildConfig(credentials))

		expect(dialConf.credentials).toEqual(credentials)
		expect(dialConf.disableSessions).toBe(true)
	})
})

describe('parseLaunchConfig', () => {
	it('accepts an access-token config', () => {
		const input = accessTokenConfig()
		const result = parseLaunchConfig(input)

		expect(result).toEqual(input)
		expect(result).not.toBe(input)
	})

	it('accepts an api-key config with expiresAt', () => {
		const input = {
			...accessTokenConfig(),
			credentials: { type: 'api-key', payload: 'secret', authEntity: 'key-id' },
			expiresAt: '2030-01-01T00:00:00Z',
			extra: 'not-kept',
		}

		const output = {
			...accessTokenConfig(),
			credentials: { type: 'api-key', payload: 'secret', authEntity: 'key-id' },
			expiresAt: '2030-01-01T00:00:00Z',
		}

		expect(parseLaunchConfig(input)).toEqual(output)
	})

	it('rejects a non-object', () => {
		expect(() => parseLaunchConfig('nope')).toThrow('not an object')
		expect(() => parseLaunchConfig(null)).toThrow('not an object')
	})

	it('names the unsupported version', () => {
		expect(() => parseLaunchConfig({ ...accessTokenConfig(), version: 2 })).toThrow(
			'Launch file version 2 is not supported, expected 1'
		)
	})

	it.each(['host', 'partId', 'partName', 'machineName', 'signalingAddress', 'serviceHost'])(
		'names the missing field %s',
		(field) => {
			const missing: Record<string, unknown> = accessTokenConfig()
			delete missing[field]
			expect(() => parseLaunchConfig(missing)).toThrow(`"${field}"`)

			expect(() => parseLaunchConfig({ ...missing, [field]: '' })).toThrow(`"${field}"`)
		}
	)

	it('rejects missing credentials', () => {
		const missing: Record<string, unknown> = accessTokenConfig()
		delete missing.credentials
		expect(() => parseLaunchConfig(missing)).toThrow('"credentials"')
	})

	it('rejects an unknown credential type', () => {
		expect(() =>
			parseLaunchConfig({ ...accessTokenConfig(), credentials: { type: 'oauth', payload: 'x' } })
		).toThrow('"oauth"')
	})

	it('rejects an api-key without authEntity or payload', () => {
		expect(() =>
			parseLaunchConfig({ ...accessTokenConfig(), credentials: { type: 'api-key', payload: 'x' } })
		).toThrow('authEntity')
		expect(() =>
			parseLaunchConfig({
				...accessTokenConfig(),
				credentials: { type: 'api-key', authEntity: 'id' },
			})
		).toThrow('payload')
	})

	it('rejects a non-string credential payload', () => {
		expect(() =>
			parseLaunchConfig({
				...accessTokenConfig(),
				credentials: { type: 'access-token', payload: 5 },
			})
		).toThrow('payload')
	})

	it('rejects a non-string expiresAt', () => {
		expect(() => parseLaunchConfig({ ...accessTokenConfig(), expiresAt: 5 })).toThrow('expiresAt')
	})
})
