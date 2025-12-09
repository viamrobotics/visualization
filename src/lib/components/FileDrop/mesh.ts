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
	addMesh: (mesh: WorldObject<ThreeBufferGeometry>) => void,
	onError: (message: string) => void,
	onSuccess: (message: string) => void
) => Promise<void>

export const onMeshDrop: MeshDropHandler = async (
	name: string,
	ext: MeshExtension,
	result: string | ArrayBuffer | null | undefined,
	addPoints: (points: WorldObject<PointsGeometry>) => void,
	addMesh: (mesh: WorldObject<ThreeBufferGeometry>) => void,
	onError: (message: string) => void,
	onSuccess: (message: string) => void
) => {
	if (!isArrayBuffer(result)) {
		onError(`${name} failed to load.`)
		return
	}

	switch (ext) {
		case MESH_EXTENSIONS.PCD:
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
		case MESH_EXTENSIONS.PLY:
			const geometry = new PLYLoader().parse(result)
			const mesh = new WorldObject(name, undefined, undefined, {
				center: undefined,
				geometryType: { case: 'bufferGeometry', value: geometry },
			})
			addMesh(mesh)
	}

	onSuccess(`Loaded ${name}`)
}
