import { Snapshot } from '$lib/draw/v1/snapshot_pb'
import { isArrayBuffer, isString } from 'lodash-es'
import {
	type FileDropper,
	type FileDropperFailure,
	type FileDropperParams,
	type FileDropperResult,
	type SnapshotFileDropSuccess,
	FileDropperError,
} from './file-dropper'
import { Extensions } from './file-names'

const decodeJson = (params: FileDropperParams): SnapshotFileDropSuccess | FileDropperFailure => {
	const { name, content } = params
	if (!isString(content)) {
		return {
			success: false,
			error: new FileDropperError(`${name} failed to load.`),
		}
	}

	try {
		const snapshot = Snapshot.fromJsonString(content)
		return {
			success: true,
			name,
			type: 'snapshot',
			snapshot,
		}
	} catch (error) {
		return {
			success: false,
			error: new FileDropperError(`${name} failed to parse.`, { cause: error }),
		}
	}
}

const decodeBinary = (params: FileDropperParams): FileDropperResult => {
	const { name, content } = params
	if (!isArrayBuffer(content)) {
		return {
			success: false,
			error: new FileDropperError(`${name} failed to load.`),
		}
	}

	try {
		const snapshot = Snapshot.fromBinary(new Uint8Array(content))
		return {
			success: true,
			name,
			type: 'snapshot',
			snapshot,
		}
	} catch (error) {
		return {
			success: false,
			error: new FileDropperError(`${name} failed to parse.`, { cause: error }),
		}
	}
}

const decodeGzip = async (params: FileDropperParams): Promise<FileDropperResult> => {
	const { name, content } = params
	if (!isArrayBuffer(content)) {
		return {
			success: false,
			error: new FileDropperError(`${name} failed to load.`),
		}
	}

	try {
		const decompressor = new DecompressionStream('gzip')
		const blob = new Blob([content])
		const stream = blob.stream().pipeThrough(decompressor)
		const response = await new Response(stream).blob()
		const buffer = await response.arrayBuffer()
		const snapshot = Snapshot.fromBinary(new Uint8Array(buffer))
		return {
			success: true,
			name,
			type: 'snapshot',
			snapshot,
		}
	} catch (error) {
		return {
			success: false,
			error: new FileDropperError(`${name} failed to parse.`, { cause: error }),
		}
	}
}

export const snapshotDropper: FileDropper = async (params: FileDropperParams) => {
	switch (params.extension) {
		case 'json':
			return decodeJson(params)
		case 'pb':
			return decodeBinary(params)
		case 'pb.gz':
			return decodeGzip(params)
		default:
			return {
				success: false,
				error: new FileDropperError(
					`Only ${Extensions.JSON}, ${Extensions.PB} and ${Extensions.PB_GZ} snapshot files are supported.`
				),
			}
	}
}
