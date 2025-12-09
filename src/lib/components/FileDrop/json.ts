import { isString } from 'lodash-es'
import type { ValueOf } from 'type-fest'
import type { FileDropper, FileDropperOptions } from './file-dropper'

export const JSON_EXTENSIONS = {
	JSON: 'json',
} as const

export const JSON_PREFIXES = {
	SNAPSHOT: 'snapshot',
} as const

export const SUPPORTED_JSON_EXTENSIONS = [JSON_EXTENSIONS.JSON] as const
export const SUPPORTED_JSON_PREFIXES = [JSON_PREFIXES.SNAPSHOT] as const

export type JSONExtension = ValueOf<typeof JSON_EXTENSIONS>
export type JSONPrefix = ValueOf<typeof JSON_PREFIXES>

export const isJSONPrefix = (prefix: string | undefined): prefix is JSONPrefix => {
	if (!prefix) return false
	return SUPPORTED_JSON_PREFIXES.includes(prefix.toLowerCase() as JSONPrefix)
}

export const onJSONDrop: FileDropper<JSONExtension, JSONPrefix> = async (
	options: FileDropperOptions<JSONExtension, JSONPrefix>
) => {
	const { name, prefix, result } = options

	if (!isString(result)) {
		return `${name} failed to load.`
	}

	try {
		const json = JSON.parse(result)
		switch (prefix) {
			case JSON_PREFIXES.SNAPSHOT:
				// TODO: decode snapshot from JSON
				console.info('TODO: decode snapshot from JSON', json)
				return undefined
			default:
				return `${name} has an unsupported prefix: ${prefix}. Only ${SUPPORTED_JSON_PREFIXES.join(', ')} are supported.`
		}
	} catch (error) {
		console.error(`${name} failed to parse.`, error)
		return `${name} failed to parse.`
	}
}
