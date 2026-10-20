<script lang="ts">
	import type { Entity } from 'koota'
	import type { Matrix4 } from 'three'

	import { useThrelte } from '@threlte/core'

	import { traits, useQuery, useTrait } from '$lib/ecs'
	import MoveGizmo from '$lib/plugins/MoveFrame/MoveGizmo.svelte'

	import type { KinematicsWorkbench } from '../../kinematics/kinematicsWorkbench.svelte'

	import {
		dragPreviewMatrix,
		gizmoToAssembly,
		gizmoWorldMatrix,
		type PlaceableItem,
	} from '../../kinematics/gizmoPose'
	import { kinematicsItem } from '../../kinematics/kinematicsItem'

	interface Props {
		workbench: KinematicsWorkbench
		/** How the gizmo drags. `undefined` hides it. */
		mode: 'translate' | 'rotate' | undefined
	}

	const { workbench, mode }: Props = $props()

	interface DragPreview {
		entity: Entity
		/** Where the gizmo sat when the drag began, world space. */
		dragStart: Matrix4
		/** The entity's local matrix before the drag, restored when the drag writes nothing. */
		startMatrix: Matrix4
	}

	const { invalidate } = useThrelte()
	const selected = useQuery(traits.Selected)
	const selectedEntity = $derived(selected.current.length === 1 ? selected.current[0] : undefined)
	const name = useTrait(() => selectedEntity, traits.Name)

	const item = $derived.by((): PlaceableItem | undefined => {
		if (name.current === undefined) return undefined
		const found = kinematicsItem(workbench.spec, name.current)
		if (found?.kind === 'link' || found?.kind === 'joint' || found?.kind === 'tcp') return found
		return undefined
	})

	const worldMatrix = $derived(
		item ? gizmoWorldMatrix(workbench.spec, workbench.snapshot.transforms, item) : undefined
	)

	let preview: DragPreview | undefined

	const setEntityMatrix = (entity: Entity, local: Matrix4) => {
		const matrix = entity.get(traits.Matrix)
		if (!matrix) return
		matrix.copy(local)
		entity.changed(traits.Matrix)
		invalidate()
	}

	const restore = ({ entity, startMatrix }: DragPreview) => {
		if (entity.isAlive()) setEntityMatrix(entity, startMatrix)
	}

	/**
	 * Moves the selected entity with the gizmo, in the scene only. Its children follow through the
	 * hierarchy, and the rebuild after release overwrites it with the server's frames.
	 */
	const previewDrag = (dragNow: Matrix4) => {
		if (!item || !worldMatrix || !selectedEntity) return
		const startMatrix = selectedEntity.get(traits.Matrix)
		if (!startMatrix) return
		preview ??= {
			entity: selectedEntity,
			dragStart: worldMatrix.clone(),
			startMatrix: startMatrix.clone(),
		}
		const local = dragPreviewMatrix(
			workbench.spec,
			workbench.snapshot.transforms,
			item,
			preview.dragStart,
			dragNow
		)
		if (local) setEntityMatrix(preview.entity, local)
	}

	// A drag can end without a release: the mode switched off or the selection changed mid-drag.
	$effect(() => {
		void selectedEntity
		void mode
		return () => {
			if (preview) restore(preview)
			preview = undefined
		}
	})

	/**
	 * Writes the released pose. Only a release writes, because every write rebuilds the model on the
	 * server.
	 */
	const commit = (released: Matrix4) => {
		const active = preview
		preview = undefined
		if (!active || !item) return

		const pose = gizmoToAssembly(workbench.spec, workbench.snapshot.transforms, item, released)
		if (!pose) {
			restore(active)
			return
		}

		switch (item.kind) {
			case 'link': {
				workbench.updateLink(item.link.id, { origin: pose })
				break
			}
			case 'joint': {
				workbench.updateJoint(item.joint.id, { origin: pose })
				break
			}
			case 'tcp': {
				workbench.setTcpPose(pose)
				break
			}
			default: {
				const unreachable: never = item
				throw new Error(`Unhandled item ${String(unreachable)}`)
			}
		}
	}
</script>

{#if mode && worldMatrix}
	<MoveGizmo
		currentWorldMatrix={worldMatrix}
		{mode}
		space="world"
		onDrag={previewDrag}
		onRelease={commit}
	/>
{/if}
