import {
	isJSONPrefix,
	JSON_EXTENSIONS,
	SUPPORTED_JSON_EXTENSIONS,
	SUPPORTED_JSON_PREFIXES,
} from './json'
import { MESH_EXTENSIONS, SUPPORTED_MESH_EXTENSIONS } from './mesh'
import { isPBPrefix, PB_EXTENSIONS, SUPPORTED_PB_EXTENSIONS, SUPPORTED_PB_PREFIXES } from './pb'

export const SUPPORTED_EXTENSIONS = [
	...SUPPORTED_JSON_EXTENSIONS,
	...SUPPORTED_PB_EXTENSIONS,
	...SUPPORTED_MESH_EXTENSIONS,
]

export const SUPPORTED_PREFIXES = [...SUPPORTED_JSON_PREFIXES, ...SUPPORTED_PB_PREFIXES]

const isExtension = (extension: string): extension is (typeof SUPPORTED_EXTENSIONS)[number] => {
	return SUPPORTED_EXTENSIONS.includes(extension as (typeof SUPPORTED_EXTENSIONS)[number])
}

interface ParseFileSuccess {
	success: true
	extension: (typeof SUPPORTED_EXTENSIONS)[number]
	prefix: (typeof SUPPORTED_PREFIXES)[number] | undefined
}

interface ParseFileError {
	success: false
	error: string
}

type ParseFileResult = ParseFileSuccess | ParseFileError

export const parseFileName = (filename: string): ParseFileResult => {
	const [name, ...extensions] = filename.split('.')
	const suffix = extensions.at(-1)
	if (!suffix) {
		return {
			success: false,
			error: 'Could not determine file extension.',
		}
	}

	const nested = extensions.at(-2)
	const extension = nested ? `${nested}.${suffix}` : suffix
	if (!isExtension(extension)) {
		return {
			success: false,
			error: `Only ${SUPPORTED_EXTENSIONS.join(', ')} files are supported.`,
		}
	}

	const prefix = name.split('_').at(0)
	switch (extension) {
		case JSON_EXTENSIONS.JSON:
			if (!isJSONPrefix(prefix)) {
				return {
					success: false,
					error: `Only JSON files with the following prefixes are supported: ${SUPPORTED_JSON_PREFIXES.join(', ')}.`,
				}
			}
			return { success: true, extension, prefix }
		case PB_EXTENSIONS.PB:
		case PB_EXTENSIONS.PB_GZ:
			if (!isPBPrefix(prefix)) {
				return {
					success: false,
					error: `Only protocol buffer binary files with the following prefixes are supported: ${SUPPORTED_PB_PREFIXES.join(', ')}.`,
				}
			}
			return { success: true, extension, prefix }
		case MESH_EXTENSIONS.PCD:
		case MESH_EXTENSIONS.PLY:
			return {
				success: true,
				extension,
				prefix: undefined,
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
