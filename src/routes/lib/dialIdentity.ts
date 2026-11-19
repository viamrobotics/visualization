import type { DialConf } from '@viamrobotics/sdk'

/**
 * What decides whether a dial config change should redial. `ViamProvider` reconnects on any
 * change, but an account access token rotates on every refresh, and a rotated token alone must
 * not drop a live connection. So the token is left out, and any other change, such as a new API
 * key, still counts.
 */
export const dialIdentity = (partId: string, dialConf: DialConf): string =>
	JSON.stringify({
		partId,
		...dialConf,
		credentials:
			dialConf.credentials?.type === 'access-token'
				? dialConf.credentials.type
				: dialConf.credentials,
	})
