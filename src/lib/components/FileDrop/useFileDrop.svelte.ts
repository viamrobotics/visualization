import type { PointsGeometry, ThreeBufferGeometry, WorldObject } from '$lib/WorldObject.svelte'
import { parseFileName, readFile } from './file-names'
import { type JSONDropHandler } from './json'
import { type MeshDropHandler } from './mesh'
import { type PBDropHandler } from './pb'

export type DropStates = 'inactive' | 'hovering' | 'loading'

export const useFileDrop = (
	onError: (message: string) => void,
	onSuccess: (message: string) => void,
	addPoints: (points: WorldObject<PointsGeometry>) => void,
	addMesh: (mesh: WorldObject<ThreeBufferGeometry>) => void,
	onJSONDrop: JSONDropHandler,
	onMeshDrop: MeshDropHandler,
	onPBDrop: PBDropHandler
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
			const { type, extension, prefix, error } = parseFileName(file.name)
			if (error) {
				onError(error)
				continue
			}

			const reader = new FileReader()

			reader.addEventListener('loadend', () => {
				completed += 1
				if (completed === files.length) {
					dropState = 'inactive'
				}
			})

			reader.addEventListener('error', () => {
				onError(`${file.name} failed to load.`)
			})

			reader.addEventListener('load', async (event) => {
				const result = event.target?.result
				let error: string | undefined
				switch (type) {
					case 'json': {
						error = onJSONDrop(file.name, prefix, result)
						break
					}
					case 'pb': {
						error = onPBDrop(file.name, extension, prefix, result)
						break
					}
					case 'mesh': {
						error = await onMeshDrop(file.name, extension, result, addPoints, addMesh)
						break
					}
				}

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
