import type { PlainMessage } from '@bufbuild/protobuf'
import type { BufferGeometry } from 'three'

import { commonApi } from '@viamrobotics/sdk'

import { parsePlyInput } from '$lib/ply'
import { parseStlInput } from '$lib/stl'

export type MeshContentType = 'ply' | 'stl'

/**
 * Reads a content type, not a path: `meshes/base.stl` belongs in `mesh_file_path`. RDK writes a bare
 * `ply` or `stl`, so the folding and trimming are defense on a proto this repo does not own.
 */
export const meshContentType = (raw: string | undefined): MeshContentType | undefined => {
	const value = (raw ?? '').toLowerCase().split(';')[0]?.trim().split('/').at(-1)
	return value === 'ply' || value === 'stl' ? value : undefined
}

/**
 * PLY is the fallback rather than an error: it is the assumption every render path already makes.
 * The plan parser does not rely on it, gating on `meshContentType` and skipping what it cannot read.
 */
export const parseMeshInput = (mesh: string | Uint8Array, contentType?: string): BufferGeometry =>
	meshContentType(contentType) === 'stl' ? parseStlInput(mesh) : parsePlyInput(mesh)

type MeshInput = PlainMessage<commonApi.Mesh>

/**
 * The mesh each geometry was parsed from. A trajectory step decodes its own copy of the proto, so
 * identity can't tell an unchanged mesh from a new one and the source is the only exact comparison.
 */
const parsedFrom = new WeakMap<BufferGeometry, MeshInput>()

/** Parses `mesh`, recording the source so {@link isParsedFrom} can recognize an unchanged input. */
export const parseMesh = (mesh: MeshInput): BufferGeometry => {
	const geometry = parseMeshInput(mesh.mesh, mesh.contentType)
	parsedFrom.set(geometry, mesh)
	return geometry
}

/** False for a geometry {@link parseMesh} did not produce: an unrecorded source has to be reparsed. */
export const isParsedFrom = (geometry: BufferGeometry, mesh: MeshInput): boolean => {
	const source = parsedFrom.get(geometry)
	return source !== undefined && commonApi.Mesh.equals(source, mesh)
}
