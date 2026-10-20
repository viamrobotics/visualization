import { KinematicsSpec } from '$lib/buf/kinematics/v1/spec_pb'

import type { SourceFile } from './kinematicsWorkbench.svelte'

export interface ProjectFiles {
	spec: KinematicsSpec
	/** Named by the `mesh_path` each satisfies, ready for `loadProject`. */
	sources: SourceFile[]
	/** Source paths no file matched, sorted. */
	missing: string[]
}

/**
 * Finds a project among loose or folder-dropped files: the shallowest `kinematics.json`, parsed as
 * protojson, and a file for each link's `mesh_path`. A path matches by its location relative to
 * the spec first, then by a basename only one file has.
 *
 * @param files Named by their path within the drop, `/`-separated.
 * @returns `undefined` when no file is named `kinematics.json`.
 * @throws When the spec file does not parse, with the parse error as `cause`.
 */
export const projectFromFiles = (files: SourceFile[]): ProjectFiles | undefined => {
	const specFile = shallowestSpecFile(files)
	if (!specFile) return undefined

	let spec: KinematicsSpec
	try {
		spec = KinematicsSpec.fromJsonString(new TextDecoder().decode(specFile.bytes))
	} catch (error) {
		throw new Error(`${specFile.name} is not a valid kinematics spec`, { cause: error })
	}

	const specDirectory = specFile.name.slice(0, specFile.name.length - SPEC_FILE_NAME.length)
	const candidates = files.filter((file) => file !== specFile)
	const sources: SourceFile[] = []
	const missing: string[] = []

	for (const meshPath of new Set(spec.links.map((link) => link.meshPath))) {
		const relative = meshPath.replace(/^\.\//, '')
		const exact = candidates.find((file) => file.name === specDirectory + relative)
		const sameName = candidates.filter((file) => basename(file.name) === basename(relative))
		const match = exact ?? (sameName.length === 1 ? sameName[0] : undefined)
		if (match) sources.push({ name: meshPath, bytes: match.bytes })
		else missing.push(meshPath)
	}

	return { spec, sources, missing: missing.toSorted() }
}

const SPEC_FILE_NAME = 'kinematics.json'

const basename = (path: string): string => path.slice(path.lastIndexOf('/') + 1)

const shallowestSpecFile = (files: SourceFile[]): SourceFile | undefined => {
	const depth = (file: SourceFile) => file.name.split('/').length
	return files
		.filter((file) => basename(file.name) === SPEC_FILE_NAME)
		.toSorted((a, b) => depth(a) - depth(b) || a.name.localeCompare(b.name))[0]
}
