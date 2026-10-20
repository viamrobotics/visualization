import type { SourceFile } from './kinematicsWorkbench.svelte'

/**
 * The name of the one folder every file was dropped in, from the first segment of their
 * `/`-separated names. A drop of loose files has none.
 *
 * @returns `undefined` unless every file is inside the same top-level folder.
 */
export const commonFolderName = (files: SourceFile[]): string | undefined => {
	const folders = new Set(
		files.map((file) => (file.name.includes('/') ? file.name.split('/')[0] : ''))
	)
	const [folder] = folders
	return folders.size === 1 && folder ? folder : undefined
}
