import type { DropStates } from '$lib/hooks/useFileDrop.svelte'
import type { ValueOf } from 'type-fest'

export const MESH_EXTENSIONS = {
	PCD: 'pcd',
	PLY: 'ply',
}

export const SUPPORTED_MESH_EXTENSIONS = [MESH_EXTENSIONS.PCD, MESH_EXTENSIONS.PLY]

export const onMeshDrop = (
	event: DragEvent,
	setDropState: (state: DropStates) => void,
	onLoad: (
		extension: ValueOf<typeof MESH_EXTENSIONS>,
		result: string | ArrayBuffer | null | undefined
	) => void,
	onSuccess: (message: string) => void,
	onError: (message: string) => void
) => {
	event.preventDefault()

	if (event.dataTransfer === null) {
		return
	}

	let completed = 0

	const { files } = event.dataTransfer

	for (const file of files) {
		const ext = file.name.split('.').at(-1)

		if (!ext) {
			onError(`Could not determine file extension.`)
			continue
		}

		if (!SUPPORTED_MESH_EXTENSIONS.includes(ext)) {
			onError(
				`Only ${SUPPORTED_MESH_EXTENSIONS.map((file) => `.${file}`).join(', ')} files are supported.`
			)
			continue
		}

		const reader = new FileReader()

		reader.addEventListener('loadend', () => {
			completed += 1

			if (completed === files.length) {
				setDropState('inactive')
				onSuccess(
					`${files.length === 1 ? file.name : `${files.length} files`} loaded successfully.`
				)
			}
		})

		reader.addEventListener('error', () => {
			onError(`${file.name} failed to load.`)
		})

		reader.addEventListener('load', async (event) => {
			const arrayBuffer = event.target?.result

			if (!arrayBuffer || typeof arrayBuffer === 'string') {
				onError(`${file.name} failed to load.`)

				return
			}

			onLoad(ext, arrayBuffer)
		})

		reader.readAsArrayBuffer(file)
		setDropState('loading')
	}
}
