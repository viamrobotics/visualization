<script lang="ts">
	import { traits, useWorld } from '$lib/ecs'
	import { parsePcdInWorker } from '$lib/lib'
	import { useToast, ToastVariant } from '@viamrobotics/prime-core'
	import { PLYLoader } from 'three/examples/jsm/Addons.js'

	let { ...rest } = $props()

	const world = useWorld()

	type DropStates = 'inactive' | 'hovering' | 'loading'

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

	const toast = useToast()

	const extensions = {
		PCD: 'pcd',
		PLY: 'ply',
	}
	const supportedFiles = [extensions.PCD, extensions.PLY]

	const ondrop = (event: DragEvent) => {
		event.preventDefault()

		if (event.dataTransfer === null) {
			return
		}

		let completed = 0

		const { files } = event.dataTransfer

		for (const file of files) {
			const ext = file.name.split('.').at(-1)

			if (!ext) {
				toast({
					message: `Could not determine file extension.`,
					variant: ToastVariant.Danger,
				})

				continue
			}

			if (!supportedFiles.includes(ext)) {
				toast({
					message: `Only ${supportedFiles.map((file) => `.${file}`).join(', ')} files are supported.`,
					variant: ToastVariant.Danger,
				})

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
				toast({
					message: `${file.name} failed to load.`,
					variant: ToastVariant.Danger,
				})
			})

			reader.addEventListener('load', async (event) => {
				const arrayBuffer = event.target?.result

				if (!arrayBuffer || typeof arrayBuffer === 'string') {
					toast({
						message: `${file.name} failed to load.`,
						variant: ToastVariant.Danger,
					})

					return
				}

				if (ext === extensions.PCD) {
					const result = await parsePcdInWorker(new Uint8Array(arrayBuffer))

					world.spawn(
						traits.Name(file.name),
						traits.PointsGeometry(result.positions),
						result.colors ? traits.VertexColors(result.colors) : traits.Color
					)

					toast({ message: `Loaded ${file.name}`, variant: ToastVariant.Success })
				} else if (ext === extensions.PLY) {
					const bufferGeometry = new PLYLoader().parse(arrayBuffer)

					world.spawn(traits.Name(file.name), traits.BufferGeometry(bufferGeometry))

					toast({ message: `Loaded ${file.name}`, variant: ToastVariant.Success })
				}
			})

			reader.readAsArrayBuffer(file)

			dropState = 'loading'
		}
	}
</script>

<svelte:window
	{ondragenter}
	{ondragleave}
	{ondragover}
/>

<div
	class={{
		'fixed inset-0 z-9999 ': true,
		'pointer-events-none': dropState === 'inactive',
		'bg-black/10': dropState !== 'inactive',
	}}
	role="region"
	aria-label="File drop zone"
	{ondrop}
	{...rest}
></div>
