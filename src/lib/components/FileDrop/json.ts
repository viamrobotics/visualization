import type { ValueOf } from 'type-fest'

export const JSON_EXTENSION = 'json'

export const JSON_PREFIXES = {
	SNAPSHOT: 'snapshot',
} as const

export const SUPPORTED_JSON_PREFIXES = [JSON_PREFIXES.SNAPSHOT] as const

export const isJSONExtension = (extension: string): extension is typeof JSON_EXTENSION => {
	return extension.toLowerCase() === JSON_EXTENSION
}

export const isJSONPrefix = (prefix: string): prefix is ValueOf<typeof JSON_PREFIXES> => {
	if (!prefix) {
		return false
	}

	return SUPPORTED_JSON_PREFIXES.includes(prefix.toLowerCase() as ValueOf<typeof JSON_PREFIXES>)
}

export const onJSONDrop = (prefix: ValueOf<typeof JSON_PREFIXES>, json: unknown) => {
	switch (prefix) {
		case JSON_PREFIXES.SNAPSHOT:
			console.info('decode snapshot from JSON', json)
			// TODO: decode snapshot from JSON
			break
		default:
			break
	}
}
