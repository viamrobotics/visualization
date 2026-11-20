import type { SimDocument, SimExportNote } from './sim-scene'

import { exportNotesText } from './export-notes-text'
import { meshToStl } from './mesh-to-stl'

/**
 * Makes `urdf/` a Gazebo model folder as well as a plain URDF package, so `gz sim` can load it from
 * a resource path. Isaac ignores it.
 */
const GAZEBO_MODEL_CONFIG = `<?xml version="1.0"?>
<model>
	<name>viam_scene</name>
	<version>1.0</version>
	<sdf version="1.6">scene.urdf</sdf>
	<description>Exported from the Viam visualizer.</description>
</model>
`

interface SimExportPackage {
	urdf: SimDocument
	mjcf: SimDocument
	/** Notes from building the scene, before either format added its own. */
	sceneNotes: readonly SimExportNote[]
}

const addFormat = (
	files: Record<string, Uint8Array>,
	folder: string,
	documentName: string,
	{ document, meshes, sidecars }: SimDocument
) => {
	const encoder = new TextEncoder()
	files[`${folder}/${documentName}`] = encoder.encode(document)
	for (const [path, geometry] of meshes) files[`${folder}/${path}`] = meshToStl(geometry)
	for (const [path, text] of sidecars) files[`${folder}/${path}`] = encoder.encode(text)
}

/**
 * The export as one zip: `urdf/` for Gazebo and Isaac, `mjcf/` for MuJoCo, and `export-notes.txt`
 * naming everything left out or approximated. Each folder holds its own meshes, so either works
 * moved on its own. `fflate` loads on the first export, not with the visualizer.
 */
export const packageSimExport = async ({
	urdf,
	mjcf,
	sceneNotes,
}: SimExportPackage): Promise<Blob> => {
	const { zipSync } = await import('fflate')
	const encoder = new TextEncoder()
	const files: Record<string, Uint8Array> = {}

	addFormat(files, 'urdf', 'scene.urdf', urdf)
	files['urdf/model.config'] = encoder.encode(GAZEBO_MODEL_CONFIG)
	addFormat(files, 'mjcf', 'scene.xml', mjcf)
	files['export-notes.txt'] = encoder.encode(
		exportNotesText([...sceneNotes, ...urdf.notes, ...mjcf.notes])
	)

	const zip = zipSync(files)
	return new Blob([zip.buffer as ArrayBuffer], { type: 'application/zip' })
}
