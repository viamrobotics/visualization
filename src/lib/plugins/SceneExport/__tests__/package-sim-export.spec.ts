import { unzipSync } from 'fflate'
import { BoxGeometry } from 'three'
import { describe, expect, it } from 'vitest'

import { packageSimExport } from '../package-sim-export'

const documentWithMesh = (document: string) => ({
	document,
	meshes: new Map([['meshes/crate.stl', new BoxGeometry()]]),
	sidecars: new Map<string, string>(),
	notes: [],
})

describe('packageSimExport', () => {
	it('gives each format its own folder holding the meshes its document references', async () => {
		const zip = await packageSimExport({
			urdf: documentWithMesh('<robot/>'),
			mjcf: documentWithMesh('<mujoco/>'),
			sceneNotes: [],
		})

		const files = unzipSync(new Uint8Array(await zip.arrayBuffer()))

		expect(Object.keys(files).toSorted()).toEqual([
			'export-notes.txt',
			'mjcf/meshes/crate.stl',
			'mjcf/scene.xml',
			'urdf/meshes/crate.stl',
			'urdf/model.config',
			'urdf/scene.urdf',
		])
	})

	it('lists every skipped entity under its reason in the notes file', async () => {
		const zip = await packageSimExport({
			urdf: documentWithMesh('<robot/>'),
			mjcf: documentWithMesh('<mujoco/>'),
			sceneNotes: [
				{ reason: 'point-cloud-skipped', subject: 'lidar' },
				{ reason: 'point-cloud-skipped', subject: 'depth-cam' },
			],
		})

		const files = unzipSync(new Uint8Array(await zip.arrayBuffer()))
		const notes = new TextDecoder().decode(files['export-notes.txt'])

		expect(notes).toBe(
			'Point clouds were left out. URDF and MJCF have no way to describe them.\n  - lidar\n  - depth-cam\n'
		)
	})
})
