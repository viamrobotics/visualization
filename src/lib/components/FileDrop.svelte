<script lang="ts">
	import { useDrawAPI } from '$lib/hooks/useDrawAPI.svelte'
	import { parsePcdInWorker, WorldObject } from '$lib/lib'
	import { useToast, ToastVariant } from '@viamrobotics/prime-core'

	let { ...rest } = $props()

	const { addPoints } = useDrawAPI()

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

	const ondrop = (event: DragEvent) => {
		event.preventDefault()

		if (event.dataTransfer === null) {
			return
		}

		let completed = 0

		const { files } = event.dataTransfer

		for (const file of files) {
			const ext = file.name.split('.').at(-1)

			if (ext !== '.pcd') {
				toast({
					message: `.${ext} is not a supported file type.`,
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
				toast({ message: `${file.name} failed to load.`, variant: ToastVariant.Danger })
			})

			reader.addEventListener('load', async (event) => {
				const arrayBuffer = event.target?.result

				if (!arrayBuffer || typeof arrayBuffer === 'string') {
					return
				}

				const result = await parsePcdInWorker(new Uint8Array(arrayBuffer))

				addPoints(
					new WorldObject(
						file.name,
						undefined,
						undefined,
						{
							case: 'points',
							value: result.positions,
						},
						result.colors ? { colors: result.colors } : undefined
					)
				)
				toast({ message: `Loaded ${file.name}`, variant: ToastVariant.Success })
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
