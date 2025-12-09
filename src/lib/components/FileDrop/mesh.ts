import { WorldObject, type PointsGeometry, type ThreeBufferGeometry } from '$lib/WorldObject.svelte'
import type { ValueOf } from 'type-fest'
import { parsePcdInWorker } from '$lib/loaders/pcd'
import { PLYLoader } from 'three/examples/jsm/loaders/PLYLoader.js'
import { isArrayBuffer } from 'lodash-es'

export const MESH_EXTENSIONS = {
	PCD: 'pcd',
	PLY: 'ply',
} as const

export const SUPPORTED_MESH_EXTENSIONS = [MESH_EXTENSIONS.PCD, MESH_EXTENSIONS.PLY] as const

export type MeshExtension = ValueOf<typeof MESH_EXTENSIONS>

export type MeshDropHandler = (
	name: string,
	extension: MeshExtension,
	result: string | ArrayBuffer | null | undefined,
	addPoints: (points: WorldObject<PointsGeometry>) => void,
	addMesh: (mesh: WorldObject<ThreeBufferGeometry>) => void
) => Promise<string | undefined>

export const onMeshDrop: MeshDropHandler = async (
	name: string,
	ext: MeshExtension,
	result: string | ArrayBuffer | null | undefined,
	addPoints: (points: WorldObject<PointsGeometry>) => void,
	addMesh: (mesh: WorldObject<ThreeBufferGeometry>) => void
) => {
	if (!isArrayBuffer(result)) {
		return `${name} failed to load.`
	}

	switch (ext) {
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
			addPoints(points)
			break
		}
		case MESH_EXTENSIONS.PLY: {
			const geometry = new PLYLoader().parse(result)
			const mesh = new WorldObject(name, undefined, undefined, {
				center: undefined,
				geometryType: { case: 'bufferGeometry', value: geometry },
			})
			addMesh(mesh)
			break
		}
	}

	return undefined
}
