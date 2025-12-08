import type { ValueOf } from 'type-fest'

export const PB_EXTENSIONS = {
	PB: 'pb',
	PB_GZ: 'pb.gz',
} as const

export const PB_PREFIXES = {
	SNAPSHOT: 'snapshot',
} as const

export const SUPPORTED_PB_EXTENSIONS = [PB_EXTENSIONS.PB, PB_EXTENSIONS.PB_GZ] as const

export const SUPPORTED_PB_PREFIXES = [PB_PREFIXES.SNAPSHOT] as const

export const isPBExtension = (extension: string): extension is ValueOf<typeof PB_EXTENSIONS> => {
	return (
		extension.toLowerCase() === PB_EXTENSIONS.PB || extension.toLowerCase() === PB_EXTENSIONS.PB_GZ
	)
}

export const isPBPrefix = (prefix: string): prefix is ValueOf<typeof PB_PREFIXES> => {
	if (!prefix) {
		return false
	}

	return SUPPORTED_PB_PREFIXES.includes(prefix.toLowerCase() as ValueOf<typeof PB_PREFIXES>)
}

export const onPBDrop = (
	ext: ValueOf<typeof PB_EXTENSIONS>,
	prefix: ValueOf<typeof PB_PREFIXES>,
	result: ArrayBuffer
) => {
	if (ext === PB_EXTENSIONS.PB_GZ) {
		// TODO: unzip gzip
	}

	// TODO: decode snapshot from PB
}
