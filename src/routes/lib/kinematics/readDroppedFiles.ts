import type { SourceFile } from './kinematicsWorkbench.svelte'

/**
 * Reads every file in a drop. A dropped folder is walked recursively, and each file is named by its
 * `/`-separated path from the dropped item, such as `drywall-gripper/cad/frame.stl`. A loose file is
 * named by its file name.
 */
export const readDroppedFiles = async (dataTransfer: DataTransfer): Promise<SourceFile[]> => {
	// Entries and files must be read synchronously. The items are invalidated after the first await.
	const entries: FileSystemEntry[] = []
	const looseFiles: File[] = []
	for (const item of dataTransfer.items) {
		if (item.kind !== 'file') continue
		const entry = item.webkitGetAsEntry?.()
		if (entry) entries.push(entry)
		else {
			const file = item.getAsFile()
			if (file) looseFiles.push(file)
		}
	}
	if (entries.length === 0 && looseFiles.length === 0) looseFiles.push(...dataTransfer.files)

	const walked = await Promise.all(entries.map((entry) => walkEntry(entry, '')))
	const loose = await Promise.all(looseFiles.map((file) => readFile(file)))
	return [...walked.flat(), ...loose]
}

const readFile = async (file: File, name = file.name): Promise<SourceFile> => ({
	name,
	bytes: new Uint8Array(await file.arrayBuffer()),
})

const walkEntry = async (entry: FileSystemEntry, parent: string): Promise<SourceFile[]> => {
	const path = parent + entry.name
	if (entry.isFile) {
		const file = await new Promise<File>((resolve, reject) => {
			;(entry as FileSystemFileEntry).file(resolve, reject)
		})
		return [await readFile(file, path)]
	}
	if (!entry.isDirectory) return []

	const reader = (entry as FileSystemDirectoryEntry).createReader()
	const children: FileSystemEntry[] = []
	for (;;) {
		const batch = await new Promise<FileSystemEntry[]>((resolve, reject) => {
			reader.readEntries(resolve, reject)
		})
		if (batch.length === 0) break
		children.push(...batch)
	}
	const nested = await Promise.all(children.map((child) => walkEntry(child, `${path}/`)))
	return nested.flat()
}
