<script lang="ts">
	import { useToast, ToastVariant } from '@viamrobotics/prime-core'
	import { useDrawAPI } from '$lib/hooks/useDrawAPI.svelte'
	import { isMeshExtension, onMeshDrop, SUPPORTED_MESH_EXTENSIONS } from './mesh'
	import {
		isJSONExtension,
		isJSONPrefix,
		JSON_EXTENSION,
		onJSONDrop,
		SUPPORTED_JSON_PREFIXES,
	} from './json'
	import type { HTMLAttributes } from 'svelte/elements'
	import { useFileDrop } from './useFileDrop.svelte'
	import {
		isPBExtension,
		isPBPrefix,
		onPBDrop,
		PB_EXTENSIONS,
		SUPPORTED_PB_EXTENSIONS,
		SUPPORTED_PB_PREFIXES,
	} from './pb'
	import { isArrayBuffer, isMesh, isPCD, isString } from './assertions'

	const props: HTMLAttributes<HTMLDivElement> = $props()

	const { addPoints, addMesh } = useDrawAPI()
	const toast = useToast()

	const extensions = [JSON_EXTENSION, ...SUPPORTED_PB_EXTENSIONS, ...SUPPORTED_MESH_EXTENSIONS]

	let fileDrop = useFileDrop()

	const getFileExtension = (filename: string): string => {
		const extension = filename.split('.').at(-1)
		if (!extension) {
			return ''
		}

		if (extension === 'gz') {
			const compressed = filename.split('.').at(-2)
			if (!compressed) {
				return ''
			}

			return `${compressed}.${extension}`
		}

		return extension
	}

	const ondrop = (event: DragEvent) => {
		event.preventDefault()
		console.log('ondrop', event)

		if (event.dataTransfer === null) {
			return
		}

		let completed = 0

		const { files } = event.dataTransfer
		console.log('files', files)

		for (const file of files) {
			const ext = getFileExtension(file.name)
			console.log('ext', ext)
			if (!ext) {
				toast({
					message: `Could not determine file extension.`,
					variant: ToastVariant.Danger,
				})

				continue
			}

			if (!extensions.includes(ext)) {
				toast({
					message: `Only ${extensions.join(', ')} files are supported.`,
					variant: ToastVariant.Danger,
				})

				continue
			}

			const prefix = file.name.split('_').at(0) ?? ''
			console.log('prefix', prefix)
			switch (ext) {
				case JSON_EXTENSION:
					if (!isJSONPrefix(prefix)) {
						toast({
							message: `Only ${SUPPORTED_JSON_PREFIXES.join(', ')} files are supported.`,
							variant: ToastVariant.Danger,
						})
						continue
					}
					break
				case PB_EXTENSIONS.PB:
				case PB_EXTENSIONS.PB_GZ:
					if (!isPBPrefix(prefix)) {
						toast({
							message: `Only ${SUPPORTED_PB_PREFIXES.join(', ')} files are supported.`,
							variant: ToastVariant.Danger,
						})
						continue
					}
					break
				default:
					break
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
				const result = event.target?.result

				if (isJSONExtension(ext) && isJSONPrefix(prefix)) {
					if (!isString(result)) {
						toast({
							message: `${file.name} failed to load.`,
							variant: ToastVariant.Danger,
						})

						return
					}

					onJSONDrop(prefix, JSON.parse(result))
				} else if (isPBExtension(ext) && isPBPrefix(prefix)) {
					if (!isArrayBuffer(result)) {
						toast({
							message: `${file.name} failed to load.`,
							variant: ToastVariant.Danger,
						})
						return
					}

					onPBDrop(ext, prefix, result)
				} else if (isMeshExtension(ext)) {
					if (!isArrayBuffer(result)) {
						toast({
							message: `${file.name} failed to load.`,
							variant: ToastVariant.Danger,
						})
						return
					}

					const worldObject = await onMeshDrop(file.name, ext, result)
					if (isPCD(worldObject)) {
						addPoints(worldObject)
					} else if (isMesh(worldObject)) {
						addMesh(worldObject)
					}
				}

				toast({ message: `Loaded ${file.name}`, variant: ToastVariant.Success })
			})

			if (isJSONExtension(ext)) {
				reader.readAsText(file)
			} else {
				reader.readAsArrayBuffer(file)
			}

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
	{...props}
></div>
