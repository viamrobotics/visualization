<script lang="ts">
	import { useToast, ToastVariant } from '@viamrobotics/prime-core'
	import { useFileDrop } from '$lib/hooks/useFileDrop.svelte'
	import type { HTMLAttributes } from 'svelte/elements'

	interface Props extends HTMLAttributes<HTMLDivElement> {
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		onJSON: (json: any) => void
	}

	let { onJSON, ...rest }: Props = $props()

	let fileDrop = useFileDrop()
	const toast = useToast()

	const prefixes = {
		SNAPSHOT: 'snapshot',
	}
	const supportedPrefixes = [prefixes.SNAPSHOT]

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

			if (ext !== 'json') {
				toast({
					message: `Only JSON files are supported.`,
					variant: ToastVariant.Danger,
				})

				continue
			}

			const prefix = file.name.split('_').at(0)
			if (!prefix || !supportedPrefixes.includes(prefix)) {
				toast({
					message: `Only ${supportedPrefixes.join(', ')} files are supported.`,
					variant: ToastVariant.Danger,
				})

				continue
			}

			const reader = new FileReader()

			reader.addEventListener('loadend', () => {
				completed += 1

				if (completed === files.length) {
					fileDrop.dropState = 'inactive'
				}
			})

			reader.addEventListener('error', () => {
				toast({
					message: `${file.name} failed to load.`,
					variant: ToastVariant.Danger,
				})
			})

			reader.addEventListener('load', async (event) => {
				const text = event.target?.result
				if (!text || typeof text !== 'string') {
					toast({
						message: `${file.name} failed to load.`,
						variant: ToastVariant.Danger,
					})

					return
				}

				const json = JSON.parse(text)
				onJSON(json)
			})

			reader.readAsText(file)
			fileDrop.dropState = 'loading'
		}
	}
</script>

<svelte:window
	ondragenter={fileDrop.ondragenter}
	ondragleave={fileDrop.ondragleave}
	ondragover={fileDrop.ondragover}
/>

<div
	class={{
		'fixed inset-0 z-9999': true,
		'pointer-events-none': fileDrop.dropState === 'inactive',
		'bg-black/10': fileDrop.dropState !== 'inactive',
	}}
	role="region"
	aria-label="File drop zone"
	{ondrop}
	{...rest}
></div>
