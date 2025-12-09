import type { PointsGeometry, ThreeBufferGeometry, WorldObject } from '$lib/WorldObject.svelte'
import type { FileDropper } from './file-dropper'
import { parseFileName, readFile, SUPPORTED_EXTENSIONS, SUPPORTED_PREFIXES } from './file-names'
import { JSON_EXTENSIONS, onJSONDrop } from './json'
import { MESH_EXTENSIONS, onMeshDrop } from './mesh'
import { PB_EXTENSIONS, onPBDrop } from './pb'

export type DropStates = 'inactive' | 'hovering' | 'loading'

const fileDropper = <
	E extends (typeof SUPPORTED_EXTENSIONS)[number],
	P extends (typeof SUPPORTED_PREFIXES)[number] | undefined,
>(
	extension: E
): FileDropper<E, P> => {
	switch (extension) {
		case JSON_EXTENSIONS.JSON:
			return onJSONDrop as FileDropper<E, P>
		case MESH_EXTENSIONS.PCD:
		case MESH_EXTENSIONS.PLY:
			return onMeshDrop as FileDropper<E, P>
		case PB_EXTENSIONS.PB:
		case PB_EXTENSIONS.PB_GZ:
			return onPBDrop as FileDropper<E, P>
		default:
			return () => Promise.resolve(undefined)
	}
}

export const useFileDrop = (
	onError: (message: string) => void,
	onSuccess: (message: string) => void,
	addPoints: (points: WorldObject<PointsGeometry>) => void,
	addMesh: (mesh: WorldObject<ThreeBufferGeometry>) => void
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

	const ondrop = (event: DragEvent) => {
		event.preventDefault()
		if (event.dataTransfer === null) return

		const { files } = event.dataTransfer
		let completed = 0
		for (const file of files) {
			const fileName = parseFileName(file.name)
			if (!fileName.success) {
				onError(fileName.error)
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
				onError(`${file.name} failed to load.`)
			})

			reader.addEventListener('load', async (event) => {
				const result = event.target?.result
				const dropper = fileDropper(extension)
				if (!dropper) {
					onError(
						`${file.name} has an unsupported extension: ${extension}. Only ${SUPPORTED_EXTENSIONS.join(', ')} are supported.`
					)
					return
				}

				const error = await dropper({
					name: file.name,
					extension,
					prefix,
					result,
					handlers: { addPoints, addMesh },
				})

				if (error) {
					onError(error)
				} else {
					onSuccess(`Loaded ${file.name}`)
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
