<!--
@component

A prime-controls `NumberField` that never writes `undefined`. Clearing a field to retype it would
otherwise either write `undefined` into the bound value or, when the binding ignores it, snap the
old number straight back. A cleared field is held empty instead, until a number is typed or it
loses focus, which is what prime-controls `Point` does for its own axes.
-->
<script lang="ts">
	import type { ComponentProps } from 'svelte'

	import { NumberField } from '@viamrobotics/prime-controls'

	type Props = ComponentProps<typeof NumberField> & {
		/** Undefined shows the field empty, such as for a value that differs across a selection. */
		value: number | undefined
	}

	let { value = $bindable(), onblur, ...rest }: Props = $props()

	let isCleared = $state(false)
</script>

<NumberField
	{...rest as ComponentProps<typeof NumberField>}
	onblur={(event) => {
		isCleared = false
		onblur?.(event)
	}}
	bind:value={
		() => (isCleared ? undefined : value),
		(next) => {
			isCleared = next === undefined
			if (next !== undefined) value = next
		}
	}
/>
