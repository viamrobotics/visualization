import { WorldObject } from '$lib/WorldObject.svelte'
import type { ValueOf } from 'type-fest'
import { parsePcdInWorker } from '$lib/loaders/pcd'
import { PLYLoader } from 'three/examples/jsm/loaders/PLYLoader.js'
import { isArrayBuffer } from 'lodash-es'
import type { FileDropper, FileDropperOptions } from './file-dropper'

export const MESH_EXTENSIONS = {
	PCD: 'pcd',
	PLY: 'ply',
} as const

export const SUPPORTED_MESH_EXTENSIONS = [MESH_EXTENSIONS.PCD, MESH_EXTENSIONS.PLY] as const

export type MeshExtension = ValueOf<typeof MESH_EXTENSIONS>

export const onMeshDrop: FileDropper<MeshExtension, undefined> = async (
	options: FileDropperOptions<MeshExtension, undefined>
) => {
	const { name, extension, result, handlers } = options
	if (!isArrayBuffer(result)) {
		return `${name} failed to load.`
	}

	if (!handlers) {
		throw new Error('Handlers are required for mesh file drops')
	}

	switch (extension) {
		case MESH_EXTENSIONS.PCD: {
			const message = await parsePcdInWorker(new Uint8Array(result))
			const points = new WorldObject(
				name,
				undefined,
				undefined,
				{
					center: undefined,
					geometryType: {
						case: 'points',
						value: message.positions,
					},
				},
				message.colors ? { colors: message.colors } : undefined
			)
			handlers?.addPoints(points)
			break
		}
		case MESH_EXTENSIONS.PLY: {
			const geometry = new PLYLoader().parse(result)
			const mesh = new WorldObject(name, undefined, undefined, {
				center: undefined,
				geometryType: { case: 'bufferGeometry', value: geometry },
			})
			handlers?.addMesh(mesh)
			break
		}
	}

	return undefined
}
