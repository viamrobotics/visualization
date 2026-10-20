import type { SourceFile } from '../../kinematics/kinematicsWorkbench.svelte'

/** Reads picked files, naming each by its folder path when the input picked a directory. */
export const readInputFiles = (files: File[]): Promise<SourceFile[]> =>
	Promise.all(
		files.map(async (file) => ({
			name: file.webkitRelativePath || file.name,
			bytes: new Uint8Array(await file.arrayBuffer()),
		}))
	)
