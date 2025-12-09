import { isArrayBuffer } from 'lodash-es'
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

export type PBExtension = ValueOf<typeof PB_EXTENSIONS>
export type PBPrefix = ValueOf<typeof PB_PREFIXES>

export const isPBPrefix = (prefix: string | undefined): prefix is PBPrefix => {
	if (!prefix) return false
	return SUPPORTED_PB_PREFIXES.includes(prefix.toLowerCase() as PBPrefix)
}

export type PBDropHandler = (
	name: string,
	extension: PBExtension,
	prefix: PBPrefix,
	result: string | ArrayBuffer | null | undefined,
	onError: (message: string) => void,
	onSuccess: (message: string) => void
) => void

export const onPBDrop: PBDropHandler = (
	name: string,
	extension: PBExtension,
	prefix: PBPrefix,
	result: string | ArrayBuffer | null | undefined,
	onError: (message: string) => void,
	onSuccess: (message: string) => void
) => {
	if (!isArrayBuffer(result)) {
		onError(`${name} failed to load.`)
		return
	}

	if (extension === PB_EXTENSIONS.PB_GZ) {
		// TODO: unzip gzip
	}

	switch (prefix) {
		case PB_PREFIXES.SNAPSHOT:
			// TODO: decode snapshot from PB
			console.info('TODO: decode snapshot from PB', result)
			onSuccess(`Loaded ${name}`)
			break
		default:
			onError(
				`${name} has an unsupported prefix: ${prefix}. Only ${SUPPORTED_PB_PREFIXES.join(', ')} are supported.`
			)
			break
	}
}
