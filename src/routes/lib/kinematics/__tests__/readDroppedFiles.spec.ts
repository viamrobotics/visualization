import { describe, expect, it } from 'vitest'

import { readDroppedFiles } from '../readDroppedFiles'

const fakeFile = (name: string, content: number[]) => new File([new Uint8Array(content)], name)

const fileEntry = (name: string, content: number[]) =>
	({
		name,
		isFile: true,
		isDirectory: false,
		file: (resolve: (file: File) => void) => resolve(fakeFile(name, content)),
	}) as unknown as FileSystemEntry

const directoryEntry = (name: string, children: FileSystemEntry[], batchSize = 1) =>
	({
		name,
		isFile: false,
		isDirectory: true,
		createReader: () => {
			let cursor = 0
			return {
				readEntries: (resolve: (entries: FileSystemEntry[]) => void) => {
					resolve(children.slice(cursor, cursor + batchSize))
					cursor += batchSize
				},
			}
		},
	}) as unknown as FileSystemEntry

const item = (entry: FileSystemEntry | null, file: File | null = null) => ({
	kind: 'file',
	webkitGetAsEntry: () => entry,
	getAsFile: () => file,
})

const transfer = (items: ReturnType<typeof item>[], files: File[] = []) =>
	({ items, files }) as unknown as DataTransfer

describe('readDroppedFiles', () => {
	it('walks a nested folder across several readEntries batches', async () => {
		const folder = directoryEntry('tool', [
			fileEntry('kinematics.json', [1]),
			directoryEntry('cad', [fileEntry('a.stl', [2, 3]), fileEntry('b.stl', [4])]),
		])

		const files = await readDroppedFiles(transfer([item(folder)]))

		expect(files.map((entry) => entry.name).toSorted()).toEqual([
			'tool/cad/a.stl',
			'tool/cad/b.stl',
			'tool/kinematics.json',
		])
		expect([...files.find((entry) => entry.name === 'tool/cad/a.stl')!.bytes]).toEqual([2, 3])
	})

	it('names a loose file by its file name', async () => {
		const files = await readDroppedFiles(transfer([item(fileEntry('a.stl', [7]))]))

		expect(files.map((entry) => entry.name)).toEqual(['a.stl'])
	})

	it('falls back to dataTransfer.files when no entries are available', async () => {
		const files = await readDroppedFiles(transfer([], [fakeFile('b.stl', [8])]))

		expect(files.map((entry) => entry.name)).toEqual(['b.stl'])
		expect([...files[0]!.bytes]).toEqual([8])
	})

	it('reads an item through getAsFile when it has no entry', async () => {
		const files = await readDroppedFiles(transfer([item(null, fakeFile('c.stl', [9]))]))

		expect(files.map((entry) => entry.name)).toEqual(['c.stl'])
	})
})
