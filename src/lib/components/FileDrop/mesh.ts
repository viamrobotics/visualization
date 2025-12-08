import { WorldObject, type PointsGeometry, type ThreeBufferGeometry } from '$lib/WorldObject.svelte'
import type { ValueOf } from 'type-fest'
import { parsePcdInWorker } from '$lib/loaders/pcd'
import { PLYLoader } from 'three/examples/jsm/loaders/PLYLoader.js'

export const MESH_EXTENSIONS = {
	PCD: 'pcd',
	PLY: 'ply',
} as const

export const SUPPORTED_MESH_EXTENSIONS = [MESH_EXTENSIONS.PCD, MESH_EXTENSIONS.PLY] as const

export const isMeshExtension = (
	extension: string
): extension is ValueOf<typeof MESH_EXTENSIONS> => {
	return (
		extension.toLowerCase() === MESH_EXTENSIONS.PCD ||
		extension.toLowerCase() === MESH_EXTENSIONS.PLY
	)
}

export const onMeshDrop = async (
	name: string,
	ext: ValueOf<typeof MESH_EXTENSIONS>,
	result: ArrayBuffer
): Promise<WorldObject<PointsGeometry> | WorldObject<ThreeBufferGeometry>> => {
	switch (ext) {
		case MESH_EXTENSIONS.PCD:
			const message = await parsePcdInWorker(new Uint8Array(result))
			return new WorldObject(
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
		case MESH_EXTENSIONS.PLY:
			const geometry = new PLYLoader().parse(result)
			return new WorldObject(name, undefined, undefined, {
				center: undefined,
				geometryType: { case: 'bufferGeometry', value: geometry },
			})
	}
}
