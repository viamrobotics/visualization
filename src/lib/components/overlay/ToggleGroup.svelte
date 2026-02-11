<script lang="ts">
	import { normalizeProps, useMachine } from '@zag-js/svelte'
	import * as toggle from '@zag-js/toggle-group'

	interface Props {
		multiple: boolean
		options: {
			selected?: boolean
			disabled?: boolean
			label: string
			value?: string
		}[]
		onSelect: (details: string[]) => void
	}

	let { multiple, options, onSelect }: Props = $props()

	const id = $props.id()
	const service = useMachine(toggle.machine, () => ({
		id,
		value: options
			.filter((option) => option.selected)
			.map((button) => button.value ?? button.label),
		multiple,
		onValueChange(details) {
			onSelect(details.value)
		},
	}))
	const api = $derived(toggle.connect(service, normalizeProps))
</script>

<div
	class="flex items-center"
	{...api.getRootProps()}
>
	{#each options as option (option.label)}
		{@const value = option.value ?? option.label}

		<button
			class={[
				'border-gray-8 -ml-px flex items-center justify-center border px-2 py-0.5 text-xs',
				{
					'bg-green-700 text-white': api.value.includes(value),
				},
			]}
			{...api.getItemProps({ value })}
		>
			{value}
		</button>
	{/each}
</div>

<style>
	button[data-disabled] {
		opacity: 0.5;

		filter: grayscale(100%);
	}

	button[data-focus] {
		outline: none;
	}
</style>
