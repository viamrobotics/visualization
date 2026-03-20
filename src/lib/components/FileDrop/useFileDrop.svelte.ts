import type { FileDropperSuccess } from './file-dropper'

import { Extensions, parseFileName, Prefixes, readFile } from './file-names'
import { pcdDropper } from './pcd-dropper'
import { plyDropper } from './ply-dropper'
import { snapshotDropper } from './snapshot-dropper'

type DropStates = 'inactive' | 'hovering' | 'loading'

const createFileDropper = (extension: string, prefix: string | undefined) => {
	switch (prefix) {
		case Prefixes.Snapshot: {
			return snapshotDropper
		}
	}

	switch (extension) {
		case Extensions.PCD: {
			return pcdDropper
		}
		case Extensions.PLY: {
			return plyDropper
		}
	}

	return undefined
}

export const useFileDrop = (
	onSuccess: (result: FileDropperSuccess) => void,
	onError: (message: string) => void
) => {
	let dropState = $state<DropStates>('inactive')

	// prevent default to allow drop
	const ondragenter = (event: DragEvent) => {
		event.preventDefault()
		dropState = 'hovering'
	}

	// prevent default to allow drop
	const ondragover = (event: DragEvent) => {
		event.preventDefault()
	}

	const ondragleave = (event: DragEvent) => {
		// only deactivate if really leaving the window
		if (event.relatedTarget === null) {
			dropState = 'inactive'
		}
	}

	const handleError = (error: string) => {
		onError(error)
		dropState = 'inactive'
	}

	const ondrop = (event: DragEvent) => {
		event.preventDefault()
		if (event.dataTransfer === null) return

		const { files } = event.dataTransfer
		let completed = 0
		for (const file of files) {
			const fileName = parseFileName(file.name)
			if (!fileName.success) {
				handleError(fileName.error.message)
				continue
			}

			const { extension, prefix } = fileName
			const reader = new FileReader()

			reader.addEventListener('loadend', () => {
				completed += 1
				if (completed === files.length) {
					dropState = 'inactive'
				}
			})

			reader.addEventListener('error', (event) => {
				const error = event.target?.error?.message
				console.error(`${file.name} failed to load.`, error)
				handleError(`${file.name} failed to load.`)
			})

			reader.addEventListener('load', async (event) => {
				const content = event.target?.result
				const dropper = createFileDropper(extension, prefix)
				if (!dropper) {
					handleError(`${file.name} is not a supported file type.`)
					return
				}

				const result = await dropper({
					name: file.name,
					extension,
					prefix,
					content,
				})

				if (result.success) {
					onSuccess(result)
				} else {
					handleError(result.error.message)
				}
			})

			readFile(file, reader, extension)
			dropState = 'loading'
		}
	}

	return {
		get dropState() {
			return dropState
		},

		ondrop,
		ondragenter,
		ondragover,
		ondragleave,
	}
}
