<script lang="ts">
	interface Props {
		label: string
		ariaLabel: string
		value: string
		onInput: (value: string) => void
	}

	let { label, ariaLabel, value, onInput }: Props = $props()
</script>

<span class="text-subtle-2">{label}</span>
<input
	type="number"
	aria-label={`mutable ${ariaLabel}`}
	class="max-w-24 min-w-0 flex-1 rounded border px-1 py-0.5 text-xs"
	{value}
	oninput={(e) => onInput((e.target as HTMLInputElement).value)}
/>
