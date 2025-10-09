<script lang="ts">
	interface Props {
		label: string
		ariaLabel: string
		value: string
	}

	let { label, value, ariaLabel }: Props = $props()
</script>

<div>
	<span
		class="text-subtle-2"
		aria-label={`immutable ${ariaLabel}`}>{label}</span
	>
	{value}
</div>
