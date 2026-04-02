import { isArrayBuffer } from 'lodash-es'

import { parsePcdInWorker } from '$lib/loaders/pcd'

import { type FileDropper, FileDropperError, type FileDropperParams } from './file-dropper'

export const pcdDropper: FileDropper = async (params: FileDropperParams) => {
	const { name, content } = params
	if (!isArrayBuffer(content)) {
		return {
			success: false,
			error: new FileDropperError(`${name} failed to load.`),
		}
	}

	try {
		const result = await parsePcdInWorker(new Uint8Array(content))
		return {
			success: true,
			name,
			type: 'pcd',
			pcd: result,
		}
	} catch (error) {
		return {
			success: false,
			error: new FileDropperError(`${name} failed to parse.`, { cause: error }),
		}
	}
}
