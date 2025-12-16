<script lang="ts">
	import type { HTMLAttributes } from 'svelte/elements'
	import { useToast, ToastVariant } from '@viamrobotics/prime-core'
	import { useFileDrop } from './useFileDrop.svelte'
	import { useWorld } from '$lib/ecs/useWorld'
	import type { FileDropperSuccess } from './file-dropper'
	import { traits } from '$lib/ecs'
	import { parseMetadata } from '$lib/WorldObject.svelte'
	import type { Snapshot } from '$lib/draw/v1/snapshot_pb'

	const props: HTMLAttributes<HTMLDivElement> = $props()

	const world = useWorld()
	const toast = useToast()

	const addSnapshotToWorld = (snapshot: Snapshot) => {
		for (const transform of snapshot.transforms) {
			const entity = world.spawn(
				traits.Name(transform.referenceFrame),
				traits.Pose(transform.poseInObserverFrame?.pose),
				traits.Parent(transform.poseInObserverFrame?.referenceFrame)
			)

			if (transform.physicalObject) {
				entity.add(traits.Geometry(transform.physicalObject))
			}

			if (transform.metadata) {
				const metadata = parseMetadata(transform.metadata.fields)
				if (metadata.color) {
					entity.add(traits.Color(metadata.color))
				}
			}
		}

		for (const drawing of snapshot.drawings) {
			world.spawn(
				traits.Name(drawing.referenceFrame),
				traits.Pose(drawing.poseInObserverFrame?.pose),
				traits.Parent(drawing.poseInObserverFrame?.referenceFrame)
				// TODO: Add shape
			)

			if (drawing.metadata) {
				// add shape colors
			}
		}
	}

	const fileDrop = useFileDrop(
		(result: FileDropperSuccess) => {
			switch (result.type) {
				case 'snapshot': {
					addSnapshotToWorld(result.snapshot)
					break
				}
				case 'pcd':
					world.spawn(
						traits.Name(result.name),
						traits.PointsGeometry(result.pcd.positions),
						result.pcd.colors ? traits.VertexColors(result.pcd.colors) : traits.Color,
						traits.DroppedFile
					)
					break
				case 'ply':
					world.spawn(
						traits.Name(result.name),
						traits.BufferGeometry(result.ply),
						traits.DroppedFile
					)
					break
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
