import type { AccessToken, Credential, DialWebRTCConf } from '@viamrobotics/sdk'

import type { ConnectionConfig } from './connectionConfig'
import type { LaunchConfig } from './tauri/launchConfig'

import { launchConfigToDialConf } from './tauri/launchConfig'

export interface ResolvedConnection {
	partId: string
	dialConf: DialWebRTCConf
	appCredentials: Credential | AccessToken
	launched: boolean
}

export const resolveConnection = (
	launch: LaunchConfig | undefined,
	active: ConnectionConfig | undefined
): ResolvedConnection | undefined => {
	if (launch) {
		return {
			partId: launch.partId,
			dialConf: launchConfigToDialConf(launch),
			appCredentials: launch.credentials,
			launched: true,
		}
	}

	if (!active) return undefined
	return {
		partId: active.partId,
		dialConf: {
			host: active.host,
			credentials: {
				type: 'api-key',
				payload: active.apiKeyValue,
				authEntity: active.apiKeyId,
			},
			signalingAddress: active.signalingAddress,
			disableSessions: true,
		},
		appCredentials: {
			type: 'api-key',
			payload: active.apiKeyValue,
			authEntity: active.apiKeyId,
		},
		launched: false,
	}
}
