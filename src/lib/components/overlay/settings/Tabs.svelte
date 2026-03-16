<script lang="ts">
	import type { Snippet } from 'svelte'

	import { normalizeProps, useMachine } from '@zag-js/svelte'
	import * as tabs from '@zag-js/tabs'

	interface Props {
		defaultTab?: string
		onValueChange: (value: string) => void
		items: {
			label: string
			content: Snippet
		}[]
	}

	let { defaultTab, items, onValueChange }: Props = $props()

	const id = $props.id()
	const service = useMachine(tabs.machine, () => ({
		id,
		defaultValue: defaultTab,
		onValueChange: (details) => onValueChange(details.value),
	}))

	const api = $derived(tabs.connect(service, normalizeProps))
</script>

<div
	{...api.getRootProps()}
	class="flex h-full gap-2 overflow-hidden"
>
	<div
		{...api.getListProps()}
		class="bg-gray-1 flex h-full flex-col items-start p-2 text-sm"
	>
		{#each items as item (item.label)}
			<button
				{...api.getTriggerProps({ value: item.label })}
				class="text-gray-8 w-full py-1 pr-8 pl-3 text-left"
				class:bg-gray-2={api.focusedValue === item.label}
			>
				{item.label}
			</button>
		{/each}
	</div>

	{#each items as item (item.label)}
		<div
			{...api.getContentProps({ value: item.label })}
			class="h-full w-full overflow-y-auto p-4"
		>
			{@render item.content()}
		</div>
	{/each}
</div>
