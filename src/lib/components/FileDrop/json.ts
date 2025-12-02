export const JSON_PREFIXES = {
	SNAPSHOT: 'snapshot',
}

export const SUPPORTED_JSON_PREFIXES = [JSON_PREFIXES.SNAPSHOT]

export const onJSONDrop = (result: string | ArrayBuffer | null | undefined) => {
	if (!result || typeof result !== 'string') {
		return null
	}

	return JSON.parse(result)
}
