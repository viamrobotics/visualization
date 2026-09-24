import { createViamClient, type ViamClient, type ViamClientOptions } from '@viamrobotics/sdk'

export const APP_ADDRESS = 'https://app.viam.com:443'

/** Connects to app.viam.com with an API key pair, either org-level or machine-level. */
export const connectAppClient = async (
	apiKeyId: string,
	apiKey: string,
	serviceHost: string = APP_ADDRESS
): Promise<ViamClient> => {
	const opts: ViamClientOptions = {
		serviceHost,
		credentials: {
			type: 'api-key',
			authEntity: apiKeyId,
			payload: apiKey,
		},
	}

	return createViamClient(opts)
}
