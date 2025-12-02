import { createViamClient, ViamClient, ViamClientOptions } from '@viamrobotics/sdk'

export const testConfig = {
	host: 'motion-tools-e2e-main.l6j4r7m65g.viam.cloud',
	name: 'motion-tools-e2e-main',
	partId: '9741704d-ea0e-484c-8cf8-0a849096af1e',
	apiKeyId: '76fcaf4b-4e04-4c6b-9665-c9c663ee4fad',
	apiKeyValue: 'iz95ie2bz5h617xhs2ko9eov1b5bryas',
	signalingAddress: 'https://app.viam.com:443',
	organizationId: 'd9fd430a-25ec-47ba-b548-5d1b1b2fc6d1',
}

export const connect = async (): Promise<ViamClient> => {
	const opts: ViamClientOptions = {
		serviceHost: testConfig.signalingAddress,
		credentials: {
			type: 'api-key',
			authEntity: testConfig.apiKeyId,
			payload: testConfig.apiKeyValue,
		},
	}

	return createViamClient(opts)
}
