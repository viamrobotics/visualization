import { isArrayBuffer } from 'lodash-es'
import type { ValueOf } from 'type-fest'
import type { FileDropper, FileDropperOptions } from './file-dropper'

export const PB_EXTENSIONS = {
	PB: 'pb',
	PB_GZ: 'pb.gz',
} as const

export const PB_PREFIXES = {
	SNAPSHOT: 'snapshot',
} as const

export const SUPPORTED_PB_EXTENSIONS = [PB_EXTENSIONS.PB, PB_EXTENSIONS.PB_GZ] as const
export const SUPPORTED_PB_PREFIXES = [PB_PREFIXES.SNAPSHOT] as const

export type PBExtension = ValueOf<typeof PB_EXTENSIONS>
export type PBPrefix = ValueOf<typeof PB_PREFIXES>

export const isPBPrefix = (prefix: string | undefined): prefix is PBPrefix => {
	if (!prefix) return false
	return SUPPORTED_PB_PREFIXES.includes(prefix.toLowerCase() as PBPrefix)
}

export const onPBDrop: FileDropper<PBExtension, PBPrefix> = async (
	options: FileDropperOptions<PBExtension, PBPrefix>
) => {
	const { name, extension, prefix, result } = options
	if (!isArrayBuffer(result)) {
		return `${name} failed to load.`
	}

	if (extension === PB_EXTENSIONS.PB_GZ) {
		// TODO: unzip gzip
	}

	switch (prefix) {
		case PB_PREFIXES.SNAPSHOT:
			// TODO: decode snapshot from PB
			console.info('TODO: decode snapshot from PB', result)
			return undefined
		default:
			return `${name} has an unsupported prefix: ${prefix}. Only ${SUPPORTED_PB_PREFIXES.join(', ')} are supported.`
	}
}
