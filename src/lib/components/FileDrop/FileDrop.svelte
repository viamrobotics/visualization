<script lang="ts">
	import type { HTMLAttributes } from 'svelte/elements'

	import { ToastVariant, useToast } from '@viamrobotics/prime-core'

	import { createBufferGeometry } from '$lib/attribute'
	import { traits } from '$lib/ecs'
	import { useWorld } from '$lib/ecs/useWorld'
	import { useCameraControls } from '$lib/hooks/useControls.svelte'
	import { spawnSnapshotEntities } from '$lib/snapshot'

	import type { FileDropperSuccess } from './file-dropper'

	import { useFileDrop } from './useFileDrop.svelte'

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
							position: [x * 0.001, y * 0.001, z * 0.001],
							lookAt: [lx * 0.001, ly * 0.001, lz * 0.001],
						})
					}

					break
				}
				case 'pcd': {
					const geometry = createBufferGeometry(result.pcd.positions, {
						colors: result.pcd.colors ?? undefined,
					})

					world.spawn(
						traits.Name(result.name),
						traits.BufferGeometry(geometry),
						traits.Points,
						traits.DroppedFile,
						traits.Removable
					)
					break
				}
				case 'ply': {
					world.spawn(
						traits.Name(result.name),
						traits.BufferGeometry(result.ply),
						traits.DroppedFile,
						traits.Removable
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
