<!--
@component

Mounts `KeyboardBindings` alongside `useGizmoInputs`, with a real `Gizmos` plugin
context whose `mode` a spec can drive through this component's `mode` prop. Needed
because `useGizmoInputs` reads `useGizmos()`, whose context key is private to
`useGizmos.svelte.ts`, so a spec cannot inject it through `render`'s `context` map
the way it does for the hotkeys/environment context.
-->
<script lang="ts">
	import KeyboardBindings from '$lib/components/KeyboardBindings.svelte'

	import type { GizmoMode } from '../../gizmos'

	import { useGizmoInputs } from '../../useGizmoInputs.svelte'
	import { provideGizmos } from '../../useGizmos.svelte'

	interface Props {
		mode: GizmoMode
		onCancel?: () => void
		onConfirm?: () => void
		onCommitAndContinue?: () => void
		onUndo?: () => void
	}

	let { mode, onCancel, onConfirm, onCommitAndContinue, onUndo }: Props = $props()

	const gizmos = provideGizmos(() => undefined)

	$effect(() => {
		gizmos.mode = mode
	})

	useGizmoInputs({
		onCancel: () => onCancel?.(),
		onConfirm: () => onConfirm?.(),
		onCommitAndContinue: () => onCommitAndContinue?.(),
		onUndo: () => onUndo?.(),
	})
</script>

<KeyboardBindings />
