import { describe, expect, it } from 'vitest'

import type { ConnectionConfig } from '../connectionConfig'
import type { LaunchConfig } from '../desktop/launchConfig'

import { type AccountConnection, resolveConnection } from '../resolveConnection'

const launch: LaunchConfig = {
	version: 1,
	host: 'launch.local.viam.cloud',
	partId: 'launch-part',
	partName: 'main',
	machineName: 'arm-rig',
	signalingAddress: 'https://app.viam.com:443',
	serviceHost: 'https://app.viam.com',
	credentials: { type: 'access-token', payload: 'tok' },
}

const active: ConnectionConfig = {
	host: 'active.local.viam.cloud',
	partId: 'active-part',
	apiKeyId: 'key-id',
	apiKeyValue: 'secret',
	signalingAddress: 'https://signal.example:443',
}

const account: AccountConnection = {
	part: {
		partId: 'account-part',
		partName: 'main',
		machineName: 'rover',
		host: 'rover-main.abc.viam.cloud',
	},
	accessToken: 'account-token',
}

describe('resolveConnection', () => {
	it('prefers the account part over the active config', () => {
		expect(resolveConnection(undefined, account, active)).toEqual({
			partId: 'account-part',
			dialConf: {
				host: 'rover-main.abc.viam.cloud',
				credentials: { type: 'access-token', payload: 'account-token' },
				signalingAddress: 'https://app.viam.com:443',
				disableSessions: true,
			},
			appCredentials: { type: 'access-token', payload: 'account-token' },
			launched: false,
		})
	})

	it('prefers the launch config over the account part and active config', () => {
		const resolved = resolveConnection(launch, account, active)

		expect(resolved).toEqual({
			partId: 'launch-part',
			dialConf: {
				host: 'launch.local.viam.cloud',
				credentials: launch.credentials,
				signalingAddress: 'https://app.viam.com:443',
				disableSessions: true,
			},
			appCredentials: launch.credentials,
			launched: true,
		})
	})

	it('maps the active config to api-key credentials', () => {
		expect(resolveConnection(undefined, undefined, active)).toEqual({
			partId: 'active-part',
			dialConf: {
				host: 'active.local.viam.cloud',
				credentials: { type: 'api-key', payload: 'secret', authEntity: 'key-id' },
				signalingAddress: 'https://signal.example:443',
				disableSessions: true,
			},
			appCredentials: { type: 'api-key', payload: 'secret', authEntity: 'key-id' },
			launched: false,
		})
	})

	it('returns undefined when nothing is set', () => {
		expect(resolveConnection(undefined, undefined, undefined)).toBeUndefined()
	})
})
