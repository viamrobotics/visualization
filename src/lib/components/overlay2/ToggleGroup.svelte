<script lang="ts">
	import { normalizeProps, useMachine } from '@zag-js/svelte'
	import * as toggle from '@zag-js/toggle-group'

	interface Props {
		multiple: boolean
		buttons: {
			on?: boolean
			disabled?: boolean
			label?: string
			value: string
		}[]
		onclick: (details: string[]) => void
	}

	let { multiple, buttons, onclick }: Props = $props()

	const id = $props.id()
	const service = useMachine(toggle.machine, () => ({
		id,
		value: buttons.filter((button) => button.on).map((button) => button.value),
		multiple,
		onValueChange(details) {
			onclick(details.value)
		},
	}))
	const api = $derived(toggle.connect(service, normalizeProps))
</script>

<div
	class="flex items-center"
	{...api.getRootProps()}
>
	{#each buttons as button (button.value)}
		<button
			class="-ml-px flex h-5 w-5 items-center justify-center border text-xs"
			{...api.getItemProps({ value: button.value })}
		>
			{button.label ?? button.value}
		</button>
	{/each}
</div>

<style>
	button[data-state='on'] {
		background: green;
		border-color: black;
		color: white;
	}

	button[data-disabled] {
		opacity: 0.5;

		filter: grayscale(100%);
	}

	button[data-focus] {
		outline: none;
	}
</style>
