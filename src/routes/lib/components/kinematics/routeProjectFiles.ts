import type { SourceFile } from '../../kinematics/kinematicsWorkbench.svelte'
import type { ProjectFiles } from '../../kinematics/projectFromFiles'

import { projectFromFiles } from '../../kinematics/projectFromFiles'

export type FileRoute =
	| { kind: 'zip'; file: SourceFile }
	| { kind: 'project'; project: ProjectFiles }
	| { kind: 'urdf'; files: SourceFile[] }
	| { kind: 'meshes'; files: SourceFile[] }
	| { kind: 'unsupported' }

const ZIP_FILE = /\.zip$/i
const URDF_FILE = /\.(urdf|xacro)$/i
const MESH_FILE = /\.(stl|ply|obj|dae)$/i

/**
 * Decides what to do with a set of read files. A zip wins over loose files, a `kinematics.json`
 * wins over a URDF, and a URDF over meshes. Meshes are added as links.
 *
 * @throws When a `kinematics.json` is present but does not parse.
 */
export const routeProjectFiles = (files: SourceFile[]): FileRoute => {
	const zip = files.find((file) => ZIP_FILE.test(file.name))
	if (zip) return { kind: 'zip', file: zip }

	const project = projectFromFiles(files)
	if (project) return { kind: 'project', project }

	if (files.some((file) => URDF_FILE.test(file.name))) return { kind: 'urdf', files }

	const meshes = files.filter((file) => MESH_FILE.test(file.name))
	if (meshes.length > 0) return { kind: 'meshes', files: meshes }

	return { kind: 'unsupported' }
}
