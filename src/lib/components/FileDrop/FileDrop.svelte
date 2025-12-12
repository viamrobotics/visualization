<script lang="ts">
	import type { HTMLAttributes } from 'svelte/elements'
	import { useToast, ToastVariant } from '@viamrobotics/prime-core'
	import { useFileDrop } from './useFileDrop.svelte'
	import { useWorld } from '$lib/ecs/useWorld'

	const props: HTMLAttributes<HTMLDivElement> = $props()

	const world = useWorld()
	const toast = useToast()
	const fileDrop = useFileDrop(
		world.spawn,
		(message: string) => toast({ message, variant: ToastVariant.Danger }),
		(message: string) => toast({ message, variant: ToastVariant.Success })
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
