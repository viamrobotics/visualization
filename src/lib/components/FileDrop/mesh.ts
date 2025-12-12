import type { ValueOf } from 'type-fest'
import { parsePcdInWorker } from '$lib/loaders/pcd'
import { PLYLoader } from 'three/examples/jsm/loaders/PLYLoader.js'
import { isArrayBuffer } from 'lodash-es'
import type { FileDropper, FileDropperOptions } from './file-dropper'
import { traits } from '$lib/ecs'

export const MESH_EXTENSIONS = {
	PCD: 'pcd',
	PLY: 'ply',
} as const

export const SUPPORTED_MESH_EXTENSIONS = [MESH_EXTENSIONS.PCD, MESH_EXTENSIONS.PLY] as const

export type MeshExtension = ValueOf<typeof MESH_EXTENSIONS>

export const onMeshDrop: FileDropper<MeshExtension, undefined> = async (
	options: FileDropperOptions<MeshExtension, undefined>
) => {
	const { name, extension, result, spawn } = options
	if (!isArrayBuffer(result)) {
		return `${name} failed to load.`
	}

	switch (extension) {
		case MESH_EXTENSIONS.PCD: {
			const message = await parsePcdInWorker(new Uint8Array(result))
			spawn(
				traits.Name(name),
				traits.PointsGeometry(message.positions),
				message.colors ? traits.VertexColors(message.colors) : traits.Color
			)
			break
		}
		case MESH_EXTENSIONS.PLY: {
			const geometry = new PLYLoader().parse(result)
			spawn(traits.Name(name), traits.BufferGeometry(geometry))
			break
		}
	}

	return undefined
}
