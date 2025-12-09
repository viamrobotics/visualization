import {
	isJSONPrefix,
	JSON_EXTENSIONS,
	SUPPORTED_JSON_EXTENSIONS,
	SUPPORTED_JSON_PREFIXES,
} from './json'
import { MESH_EXTENSIONS, SUPPORTED_MESH_EXTENSIONS } from './mesh'
import { isPBPrefix, PB_EXTENSIONS, SUPPORTED_PB_EXTENSIONS, SUPPORTED_PB_PREFIXES } from './pb'

const EXTENSIONS = [
	...SUPPORTED_JSON_EXTENSIONS,
	...SUPPORTED_PB_EXTENSIONS,
	...SUPPORTED_MESH_EXTENSIONS,
]

const isExtension = (extension: string): extension is (typeof EXTENSIONS)[number] => {
	return EXTENSIONS.includes(extension as (typeof EXTENSIONS)[number])
}

export const parseFileName = (filename: string) => {
	const [name, ...extensions] = filename.split('.')
	const suffix = extensions.at(-1)
	if (!suffix) {
		return {
			type: undefined,
			extension: undefined,
			prefix: undefined,
			error: 'Could not determine file extension.',
		}
	}

	const nested = extensions.at(-2)
	const extension = nested ? `${nested}.${suffix}` : suffix
	if (!isExtension(extension)) {
		return {
			type: undefined,
			extension: undefined,
			prefix: undefined,
			error: `Only ${EXTENSIONS.join(', ')} files are supported.`,
		}
	}

	const prefix = name.split('_').at(0)
	switch (extension) {
		case JSON_EXTENSIONS.JSON:
			if (!isJSONPrefix(prefix)) {
				return {
					type: undefined,
					extension: undefined,
					prefix: undefined,
					error: `Only JSON files with the following prefixes are supported: ${SUPPORTED_JSON_PREFIXES.join(', ')}.`,
				}
			}
			return {
				type: 'json' as const,
				extension: extension,
				prefix,
				error: undefined,
			}
		case PB_EXTENSIONS.PB:
		case PB_EXTENSIONS.PB_GZ:
			if (!isPBPrefix(prefix)) {
				return {
					type: undefined,
					extension: undefined,
					prefix: undefined,
					error: `Only protocol buffer binary files with the following prefixes are supported: ${SUPPORTED_PB_PREFIXES.join(', ')}.`,
				}
			}
			return {
				type: 'pb' as const,
				extension: extension,
				prefix,
				error: undefined,
			}
		case MESH_EXTENSIONS.PCD:
		case MESH_EXTENSIONS.PLY:
			return {
				type: 'mesh' as const,
				extension: extension,
				prefix: undefined,
				error: undefined,
			}
	}
}

export const readFile = (file: File, reader: FileReader, extension: string | undefined) => {
	if (!extension) return
	switch (extension) {
		case JSON_EXTENSIONS.JSON:
			return reader.readAsText(file)
		case MESH_EXTENSIONS.PCD:
		case MESH_EXTENSIONS.PLY:
		case PB_EXTENSIONS.PB:
		case PB_EXTENSIONS.PB_GZ:
			return reader.readAsArrayBuffer(file)
	}
}
