import { isArrayBuffer } from 'lodash-es'
import { FileDropperError, type FileDropper, type FileDropperParams } from './file-dropper'
import { PLYLoader } from 'three/examples/jsm/loaders/PLYLoader.js'

export const plyDropper: FileDropper = async (params: FileDropperParams) => {
	const { name, content } = params
	if (!isArrayBuffer(content)) {
		return {
			success: false,
			error: new FileDropperError(`${name} failed to load.`),
		}
	}

	try {
		const geometry = new PLYLoader().parse(new TextDecoder().decode(content))
		return {
			success: true,
			name,
			type: 'ply',
			ply: geometry,
		}
	} catch (error) {
		return {
			success: false,
			error: new FileDropperError(`${name} failed to parse.`, { cause: error }),
		}
	}
}
