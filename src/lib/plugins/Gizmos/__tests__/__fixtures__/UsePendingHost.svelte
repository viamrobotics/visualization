<!--
@component

`usePending` reads `useGizmos()` (a private context key) and `useWorld()`, neither of
which a spec can inject through `render`'s `context` map, so a host component stands
both contexts up and hands the live hook back through `onReady`. Mirrors
`GizmoInputsHost`, which does the same for `useGizmoInputs` alone.
-->
<script lang="ts">
	import type { World } from 'koota'

	import { untrack } from 'svelte'

	import KeyboardBindings from '$lib/components/KeyboardBindings.svelte'
	import { provideWorld, useWorld } from '$lib/ecs'

	import type { GizmoMode } from '../../gizmos'

	import { provideGizmos } from '../../useGizmos.svelte'
	import { usePending } from '../../usePending.svelte'

	interface Props {
		mode: GizmoMode
		onCancel?: () => void
		onConfirm?: () => void
		onCommitAndContinue?: () => void
		onUndo?: () => void
		/** Handed the live hook and the world it draws into, once, during init. */
		onReady: (pending: ReturnType<typeof usePending>, world: World) => void
	}

	const { mode, onCancel, onConfirm, onCommitAndContinue, onUndo, onReady }: Props = $props()

	provideWorld()
	const gizmos = provideGizmos(() => undefined)

	$effect(() => {
		gizmos.mode = mode
	})

	untrack(() =>
		onReady(
			usePending(() => ({
				onCancel,
				onConfirm,
				onCommitAndContinue,
				onUndo,
			})),
			useWorld()
		)
	)
</script>

<KeyboardBindings />
