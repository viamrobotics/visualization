<script
	module
	lang="ts"
>
	import type { Snippet } from 'svelte'

	export interface DetailsTab {
		/** Stable value the tabs machine tracks. Also the tab's key. */
		id: string
		label: string
		content: Snippet
	}
</script>

<script lang="ts">
	import { normalizeProps, useMachine } from '@zag-js/svelte'
	import * as tabs from '@zag-js/tabs'

	interface Props {
		/** Rendered left to right. The first one is selected until the user picks another. */
		items: DetailsTab[]
	}

	const { items }: Props = $props()

	const id = $props.id()

	let selection = $state.raw<string>()

	// Callers drop a tab when the entity has nothing to put in it, so a stale
	// selection has to fall back rather than leave every panel hidden.
	const value = $derived(items.some((item) => item.id === selection) ? selection : items[0]?.id)

	const service = useMachine(tabs.machine, () => ({
		id,
		value,
		onValueChange: (details: tabs.ValueChangeDetails) => {
			selection = details.value
		},
	}))

	const api = $derived(tabs.connect(service, normalizeProps))
</script>

<div {...api.getRootProps()}>
	<!-- A strip holding one tab is chrome with nothing to switch between. -->
	<div
		{...api.getListProps()}
		class={['border-medium -mx-2 gap-4 border-b px-2', items.length > 1 ? 'flex' : 'hidden']}
	>
		{#each items as item (item.id)}
			<button
				{...api.getTriggerProps({ value: item.id })}
				class={[
					'focus-visible:outline-gray-6 -mb-px cursor-pointer border-b-[1.5px] pt-2 pb-1.5',
					'hover:text-default focus-visible:outline focus-visible:-outline-offset-1',
					api.value === item.id
						? 'border-gray-9 font-semibold'
						: 'text-subtle-2 border-transparent',
				]}
			>
				{item.label}
			</button>
		{/each}
	</div>

	{#each items as item (item.id)}
		<div {...api.getContentProps({ value: item.id })}>
			{@render item.content()}
		</div>
	{/each}
</div>
