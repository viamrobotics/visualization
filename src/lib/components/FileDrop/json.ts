import { isString } from 'lodash-es'
import type { ValueOf } from 'type-fest'

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

export const isJSONExtension = (extension: string): extension is JSONExtension => {
	return SUPPORTED_JSON_EXTENSIONS.includes(extension.toLowerCase() as JSONExtension)
}

export const isJSONPrefix = (prefix: string | undefined): prefix is JSONPrefix => {
	if (!prefix) return false
	return SUPPORTED_JSON_PREFIXES.includes(prefix.toLowerCase() as JSONPrefix)
}

export type JSONDropHandler = (
	name: string,
	prefix: JSONPrefix,
	result: string | ArrayBuffer | null | undefined,
	onError: (message: string) => void,
	onSuccess: (message: string) => void
) => void

export const onJSONDrop: JSONDropHandler = (
	name: string,
	prefix: JSONPrefix,
	result: string | ArrayBuffer | null | undefined,
	onError: (message: string) => void,
	onSuccess: (message: string) => void
) => {
	if (!isString(result)) {
		onError(`${name} failed to load.`)
		return
	}

	try {
		const json = JSON.parse(result)
		switch (prefix) {
			case JSON_PREFIXES.SNAPSHOT:
				// TODO: decode snapshot from JSON
				console.info('TODO: decode snapshot from JSON', json)
				onSuccess(`Loaded ${name}`)
				break
			default:
				onError(
					`${name} has an unsupported prefix: ${prefix}. Only ${SUPPORTED_JSON_PREFIXES.join(', ')} are supported.`
				)
				break
		}
	} catch (error) {
		console.error(`${name} failed to parse.`, error)
		onError(`${name} failed to parse.`)
		return
	}
}
