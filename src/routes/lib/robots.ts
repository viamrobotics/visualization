import type { DialWebRTCConf } from '@viamrobotics/sdk'

import type { ConnectionConfig } from './connectionConfig'

type PlaygroundRobotsConfig = Record<string, ConnectionConfig>

export const getDialConfs = (robots: PlaygroundRobotsConfig): Record<string, DialWebRTCConf> =>
	Object.fromEntries(Object.values(robots).map((robot) => [robot.partId, getDialConf(robot)]))

const getDialConf = (robot: PlaygroundRobotsConfig[string]): DialWebRTCConf => {
	return {
		host: robot.host,
		credentials: {
			type: 'api-key',
			payload: robot.apiKeyValue,
			authEntity: robot.apiKeyId,
		},
		signalingAddress: robot.signalingAddress,
		disableSessions: Boolean(robot.disableSessions),
	}
}
