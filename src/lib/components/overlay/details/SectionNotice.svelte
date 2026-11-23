<script lang="ts">
	interface Props {
		/** The section the notice stands in for, as its heading would read. */
		label: string
		/** Why the section isn't shown for this selection. */
		message: string
	}

	const { label, message }: Props = $props()
</script>

<div
	role="note"
	aria-label={label}
>
	<strong class="font-semibold">{label}</strong>
	<p class="text-subtle-2">{message}</p>
</div>
