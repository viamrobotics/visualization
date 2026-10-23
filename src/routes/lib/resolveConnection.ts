import type { Credentials, DialWebRTCConf } from '@viamrobotics/sdk'

import type { ConnectionConfig } from './connectionConfig'
import type { LaunchConfig } from './desktop/launchConfig'

import { launchConfigToDialConf } from './desktop/launchConfig'
import { getApiKeyCredential, getDialConf } from './robots'

export interface ResolvedConnection {
	partId: string
	dialConf: DialWebRTCConf
	appCredentials: Credentials
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
		dialConf: getDialConf({ ...active, disableSessions: true }),
		appCredentials: getApiKeyCredential(active),
		launched: false,
	}
}
