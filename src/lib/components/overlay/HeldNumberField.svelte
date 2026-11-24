<!--
@component

A prime-controls `NumberField` whose display holds what the user types. While the input is focused
it shows the typed draft, and each number in it is written through, so the bound setter may clamp
or reject an intermediate value, such as the 1 on the way to 150, without rewriting the field under
the cursor. A cleared field writes nothing. On blur, the field shows the bound value again.
Scrubbing the label doesn't focus the input, so a scrub shows each value as it is written.
-->
<script lang="ts">
	import type { ComponentProps } from 'svelte'

	import { NumberField } from '@viamrobotics/prime-controls'

	type Props = ComponentProps<typeof NumberField> & {
		/** Undefined shows the field empty, such as for a value that differs across a selection. */
		value: number | undefined
	}

	let { value = $bindable(), onfocus, onblur, ...rest }: Props = $props()

	let isFocused = $state(false)
	let draft = $state<number>()
</script>

<NumberField
	{...rest as ComponentProps<typeof NumberField>}
	onfocus={(event) => {
		isFocused = true
		draft = value
		onfocus?.(event)
	}}
	onblur={(event) => {
		isFocused = false
		onblur?.(event)
	}}
	bind:value={
		() => (isFocused ? draft : value),
		(next) => {
			draft = next
			if (next !== undefined) value = next
		}
	}
/>
