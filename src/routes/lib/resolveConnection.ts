import type { Credentials, DialWebRTCConf } from '@viamrobotics/sdk'

import type { ConnectionConfig } from './connectionConfig'
import type { LaunchConfig } from './desktop/launchConfig'
import type { AccountPart } from './viamLogin/useAccountPart.svelte'

import { launchConfigToDialConf } from './desktop/launchConfig'
import { getApiKeyCredential, getDialConf } from './robots'

const ACCOUNT_SIGNALING_ADDRESS = 'https://app.viam.com:443'

export interface ResolvedConnection {
	partId: string
	dialConf: DialWebRTCConf
	appCredentials: Credentials
	launched: boolean
}

/** A part picked from the logged-in Viam account, with the session's current token. */
export interface AccountConnection {
	part: AccountPart
	accessToken: string
}

/**
 * The connection to dial. A CLI launch file wins, then a part picked from the Viam account, then
 * the manual config switched on in the machines popover.
 */
export const resolveConnection = (
	launch: LaunchConfig | undefined,
	account: AccountConnection | undefined,
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

	if (account) {
		const credentials: Credentials = { type: 'access-token', payload: account.accessToken }
		return {
			partId: account.part.partId,
			dialConf: {
				host: account.part.host,
				credentials,
				signalingAddress: ACCOUNT_SIGNALING_ADDRESS,
				disableSessions: true,
			},
			appCredentials: credentials,
			launched: false,
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
