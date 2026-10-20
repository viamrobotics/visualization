<script lang="ts">
	import { Select } from '@viamrobotics/prime-core'

	interface Props {
		label: string
		/** The selected joint id, or `''` for the model base. */
		value: string
		/** Joint ids to offer besides the base. */
		options: string[]
		/** The label for the empty value. */
		baseLabel?: string
		onchange: (parent: string) => void
	}

	let { label, value, options, baseLabel = 'Base', onchange }: Props = $props()
</script>

<label class="text-default flex items-center justify-between gap-2 text-xs">
	{label}
	<Select
		{value}
		on:change={(event) => onchange((event.target as HTMLSelectElement).value)}
	>
		<option value="">{baseLabel}</option>
		{#each options as option (option)}
			<option value={option}>{option}</option>
		{/each}
	</Select>
</label>
