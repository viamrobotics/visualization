<script lang="ts">
	import type { HTMLAttributes } from 'svelte/elements'
	import { useToast, ToastVariant } from '@viamrobotics/prime-core'
	import { useDrawAPI } from '$lib/hooks/useDrawAPI.svelte'
	import { onMeshDrop } from './mesh'
	import { onJSONDrop } from './json'
	import { onPBDrop } from './pb'
	import { useFileDrop } from './useFileDrop.svelte'

	const props: HTMLAttributes<HTMLDivElement> = $props()

	const { addPoints, addMesh } = useDrawAPI()
	const toast = useToast()
	const fileDrop = useFileDrop(
		(message: string) => toast({ message, variant: ToastVariant.Danger }),
		(message: string) => toast({ message, variant: ToastVariant.Success }),
		addPoints,
		addMesh,
		onJSONDrop,
		onMeshDrop,
		onPBDrop
	)
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
	ondrop={fileDrop.ondrop}
	{...props}
></div>
