/** A machine connection the picker can edit: an env config or one persisted in IndexedDB. */
export interface ConnectionConfig {
	host: string
	partId: string
	apiKeyId: string
	apiKeyValue: string
	signalingAddress: string
}
