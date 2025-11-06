interface ConnectionConfig {
	host: string
	partId: string
	apiKeyId: string
	apiKeyValue: string
	signalingAddress: string
}

const parseConfigs = () => {
	const rawRobots = import.meta.env.VITE_CONFIGS

	if (!rawRobots) {
		console.warn('Cannot find configs. Please read the README.md for more info')
	}

	return JSON.parse(rawRobots ?? '{}')
}

export const envDialConfigs: Record<string, ConnectionConfig> = parseConfigs()

export const envConfigs = Object.values(envDialConfigs)
