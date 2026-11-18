import type { DialConf } from '@viamrobotics/sdk'

import { describe, expect, it } from 'vitest'

import { dialIdentity } from '../dialIdentity'

const accountDial: DialConf = {
	host: 'rover-main.abc.viam.cloud',
	credentials: { type: 'access-token', payload: 'token-1' },
	signalingAddress: 'https://app.viam.com:443',
	disableSessions: true,
}

const apiKeyDial: DialConf = {
	...accountDial,
	credentials: { type: 'api-key', payload: 'secret-1', authEntity: 'key-id' },
}

describe('dialIdentity', () => {
	it('ignores a refreshed access token, so a refresh does not redial', () => {
		const refreshed: DialConf = {
			...accountDial,
			credentials: { type: 'access-token', payload: 'token-2' },
		}

		expect(dialIdentity('part', refreshed)).toBe(dialIdentity('part', accountDial))
	})

	it('changes when an API key changes', () => {
		const rotated = {
			...apiKeyDial,
			credentials: { ...apiKeyDial.credentials!, payload: 'secret-2' },
		}

		expect(dialIdentity('part', rotated)).not.toBe(dialIdentity('part', apiKeyDial))
	})

	it('changes when the host or part changes', () => {
		expect(dialIdentity('part', { ...accountDial, host: 'other.viam.cloud' })).not.toBe(
			dialIdentity('part', accountDial)
		)
		expect(dialIdentity('other-part', accountDial)).not.toBe(dialIdentity('part', accountDial))
	})
})
