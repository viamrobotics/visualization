import type { DialWebRTCConf } from '@viamrobotics/sdk'

export type PlaygroundRobotsConfig = Record<
	string,
	{
		host: string
		partId: string
		apiKeyId: string
		apiKeyValue: string
		signalingAddress: string
		disableSessions?: boolean
	}
>

export const loadRobots = () => {
	const rawRobots = import.meta.env.VITE_PLAYGROUND_ROBOTS

	if (!rawRobots) {
		throw new Error(
			'Cannot find VITE_PLAYGROUND_ROBOTS. Please read the README.md playground section for more info'
		)
	}

	return JSON.parse(rawRobots) as PlaygroundRobotsConfig
}

export const getDialConfs = (robots: PlaygroundRobotsConfig): Record<string, DialWebRTCConf> =>
	Object.fromEntries(Object.values(robots).map((robot) => [robot.partId, getDialConf(robot)]))

export const getDialConf = (robot: PlaygroundRobotsConfig[string]): DialWebRTCConf => ({
	host: robot.host,
	credentials: {
		type: 'api-key',
		payload: robot.apiKeyValue,
		authEntity: robot.apiKeyId,
	},
	signalingAddress: robot.signalingAddress,
	disableSessions: Boolean(robot.disableSessions),
})
