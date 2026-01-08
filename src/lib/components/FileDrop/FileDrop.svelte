<script lang="ts">
	import type { HTMLAttributes } from 'svelte/elements'
	import { useToast, ToastVariant } from '@viamrobotics/prime-core'
	import { useFileDrop } from './useFileDrop.svelte'
	import { useWorld } from '$lib/ecs/useWorld'
	import type { FileDropperSuccess } from './file-dropper'
	import { traits } from '$lib/ecs'
	import { spawnSnapshotEntities } from '$lib/snapshot'
	import { useCameraControls } from '$lib/hooks/useControls.svelte'
	import { createBufferGeometry } from '$lib/attribute'

	const props: HTMLAttributes<HTMLDivElement> = $props()

	const world = useWorld()
	const toast = useToast()
	const cameraControls = useCameraControls()

	const fileDrop = useFileDrop(
		(result: FileDropperSuccess) => {
			switch (result.type) {
				case 'snapshot': {
					spawnSnapshotEntities(world, result.snapshot)

					const { sceneCamera } = result.snapshot.sceneMetadata ?? {}

					if (sceneCamera) {
						const { x = 0, y = 0, z = 0 } = sceneCamera.position ?? {}
						const { x: lx = 0, y: ly = 0, z: lz = 0 } = sceneCamera.lookAt ?? {}

						cameraControls.setPose({
							position: [x, y, z],
							lookAt: [lx, ly, lz],
						})
					}

					break
				}
				case 'pcd': {
					const geometry = createBufferGeometry(result.pcd.positions, result.pcd.colors)

					world.spawn(
						traits.Name(result.name),
						traits.BufferGeometry(geometry),
						traits.Points,
						traits.DroppedFile
					)
					break
				}
				case 'ply': {
					world.spawn(
						traits.Name(result.name),
						traits.BufferGeometry(result.ply),
						traits.DroppedFile
					)
					break
				}
			}

			toast({ message: `${result.name} loaded.`, variant: ToastVariant.Success })
		},
		(message) => toast({ message, variant: ToastVariant.Danger })
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
