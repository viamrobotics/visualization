import type { Credential, DialWebRTCConf } from '@viamrobotics/sdk'

import type { ConnectionConfig } from './connectionConfig'

export const getApiKeyCredential = (config: ConnectionConfig): Credential => ({
	type: 'api-key',
	payload: config.apiKeyValue,
	authEntity: config.apiKeyId,
})

export const getDialConf = (config: ConnectionConfig): DialWebRTCConf => ({
	host: config.host,
	credentials: getApiKeyCredential(config),
	signalingAddress: config.signalingAddress,
	disableSessions: Boolean(config.disableSessions),
})
