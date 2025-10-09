<script lang="ts">
	interface Props {
		ariaLabel: string
		value: string
		options: string[]
		onChange: (value: string) => void
	}

	let { ariaLabel, value, options, onChange }: Props = $props()
</script>

<select
	aria-label={`dropdown ${ariaLabel}`}
	class="w-full rounded border border-gray-300 px-2 py-1 text-sm"
	{value}
	onchange={(e) => onChange((e.target as HTMLSelectElement).value)}
>
	{#each options as option (option)}
		<option value={option}>{option}</option>
	{/each}
</select>
