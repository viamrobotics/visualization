interface ConnectionConfig {
	host: string
	partId: string
	apiKeyId: string
	apiKeyValue: string
	signalingAddress: string
	disableSessions?: boolean
}
export declare const envDialConfigs: Record<string, ConnectionConfig>
export {}
