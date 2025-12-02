<script lang="ts">
	import { useToast, ToastVariant } from '@viamrobotics/prime-core'
	import { useDrawAPI } from '$lib/hooks/useDrawAPI.svelte'
	import { MESH_EXTENSIONS, SUPPORTED_MESH_EXTENSIONS } from './mesh'
	import { JSON_PREFIXES, SUPPORTED_JSON_PREFIXES } from './json'
	import type { ValueOf } from 'type-fest'
	import { parsePcdInWorker } from '$lib/loaders/pcd'
	import { WorldObject } from '$lib/WorldObject.svelte'
	import { PLYLoader } from 'three/examples/jsm/loaders/PLYLoader.js'
	import { useSnapshot } from '$lib/hooks/useSnapshot.svelte'
	import { decodeSnapshotFromJSON } from '$lib/snapshot'
	import type { HTMLAttributes } from 'svelte/elements'
	import { useFileDrop } from './useFileDrop.svelte'

	const props: HTMLAttributes<HTMLDivElement> = $props()

	const { addPoints, addMesh } = useDrawAPI()
	const snapshot = useSnapshot()
	const toast = useToast()

	const extensions = ['json', ...SUPPORTED_MESH_EXTENSIONS]

	let fileDrop = useFileDrop()

	const isString = (result: string | ArrayBuffer | null | undefined): result is string => {
		return result !== null && result !== undefined && typeof result === 'string'
	}

	const isArrayBuffer = (
		result: string | ArrayBuffer | null | undefined
	): result is ArrayBuffer => {
		return result !== null && result !== undefined && typeof result !== 'string'
	}

	const onJSON = (prefix: ValueOf<typeof JSON_PREFIXES>, json: unknown) => {
		if (prefix === JSON_PREFIXES.SNAPSHOT) {
			snapshot.current = undefined

			try {
				const decodedSnapshot = decodeSnapshotFromJSON(json)
				snapshot.current = decodedSnapshot

				toast({
					message: `Loaded snapshot with ${decodedSnapshot.transforms.length + decodedSnapshot.drawings.length} world objects`,
					variant: ToastVariant.Success,
				})
			} catch (error) {
				console.error('error decoding snapshot', error)
				const errorMessage = error instanceof Error ? error.message : String(error)
				toast({
					message: `Failed to load snapshot: ${errorMessage}`,
					variant: ToastVariant.Danger,
				})
			}
		}
	}

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

			if (!extensions.includes(ext)) {
				toast({
					message: `Only ${extensions.join(', ')} files are supported.`,
					variant: ToastVariant.Danger,
				})

				continue
			}

			const prefix = file.name.split('_').at(0)
			if (ext === 'json') {
				if (!prefix || !SUPPORTED_JSON_PREFIXES.includes(prefix)) {
					toast({
						message: `Only ${SUPPORTED_JSON_PREFIXES.join(', ')} files are supported.`,
						variant: ToastVariant.Danger,
					})

					continue
				}
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

				if (ext === 'json' && prefix) {
					if (!isString(result)) {
						toast({
							message: `${file.name} failed to load.`,
							variant: ToastVariant.Danger,
						})

						return
					}

					onJSON(prefix, JSON.parse(result))
				} else if (ext === MESH_EXTENSIONS.PCD) {
					if (!isArrayBuffer(result)) {
						toast({
							message: `${file.name} failed to load.`,
							variant: ToastVariant.Danger,
						})

						return
					}

					const message = await parsePcdInWorker(new Uint8Array(result))
					addPoints(
						new WorldObject(
							file.name,
							undefined,
							undefined,
							{
								center: undefined,
								geometryType: {
									case: 'legacyPoints',
									value: message.positions,
								},
							},
							message.colors ? { colors: message.colors } : undefined
						)
					)

					toast({ message: `Loaded ${file.name}`, variant: ToastVariant.Success })
				} else if (ext === MESH_EXTENSIONS.PLY) {
					if (!isArrayBuffer(result)) {
						toast({
							message: `${file.name} failed to load.`,
							variant: ToastVariant.Danger,
						})

						return
					}

					const geometry = new PLYLoader().parse(result)
					addMesh(
						new WorldObject(file.name, undefined, undefined, {
							center: undefined,
							geometryType: { case: 'bufferGeometry', value: geometry },
						})
					)

					toast({ message: `Loaded ${file.name}`, variant: ToastVariant.Success })
				}
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
	{...props}
></div>
