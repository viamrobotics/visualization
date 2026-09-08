<!--
@component

The pointer-only counterpart to `useGizmoInputs`'s keyboard bindings. A multi-click gizmo
tool has no way to confirm, cancel, undo, or commit-and-continue without a keyboard, so this
panel floats above the last placed point and offers the same four actions as real buttons.
Duplicating the hotkeys here is the point, not an accident: it exists so a pointer-only user
can finish a placement at all.
-->
<script lang="ts">
	import type { Vector3Tuple } from 'three'

	import { HTML } from '@threlte/extras'
	import { IconButton } from '@viamrobotics/prime-core'

	interface Props {
		/** World position the panel anchors to, typically the most recently placed point. */
		position: Vector3Tuple
		/** Whether undoing the last placed point currently makes sense. */
		canUndo: boolean
		/** Whether the current placement can be confirmed as-is. */
		canConfirm: boolean
		/** Whether the current placement can be committed so another point can be added. */
		canCommitAndContinue: boolean
		onCancel: () => void
		onConfirm: () => void
		onCommitAndContinue: () => void
		onUndo: () => void
	}

	const {
		position,
		canUndo,
		canConfirm,
		canCommitAndContinue,
		onCancel,
		onConfirm,
		onCommitAndContinue,
		onUndo,
	}: Props = $props()
</script>

<HTML
	center
	{position}
	zIndexRange={[100, 0]}
>
	<div
		role="group"
		aria-label="Confirm placement"
		class="border-medium pointer-events-auto flex -translate-y-10 gap-1 rounded border bg-white p-1 shadow-sm"
	>
		<IconButton
			icon="undo"
			label="Undo last point"
			variant="secondary"
			disabled={!canUndo}
			onclick={onUndo}
		/>
		<IconButton
			icon="close"
			label="Cancel"
			variant="secondary"
			onclick={onCancel}
		/>
		<IconButton
			icon="plus"
			label="Commit and add another point"
			variant="secondary"
			disabled={!canCommitAndContinue}
			onclick={onCommitAndContinue}
		/>
		<IconButton
			icon="check"
			label="Confirm"
			variant="primary"
			disabled={!canConfirm}
			onclick={onConfirm}
		/>
	</div>
</HTML>
