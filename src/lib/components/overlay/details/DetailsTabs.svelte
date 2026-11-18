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
		/** Leaves the panel unpainted so a `<View>` behind it shows through. */
		transparent?: boolean
	}
</script>

<script lang="ts">
	import { normalizeProps, useMachine } from '@zag-js/svelte'
	import * as tabs from '@zag-js/tabs'
	import { PersistedState } from 'runed'

	interface Props {
		/** Rendered left to right. The first one is selected until the user picks another. */
		items: DetailsTab[]
	}

	const { items }: Props = $props()

	const id = $props.id()

	const selection = new PersistedState<string | undefined>('details-active-tab', undefined)

	// Callers drop a tab when the entity has nothing to put in it, so a stale
	// selection has to fall back rather than leave every panel hidden.
	const value = $derived(
		items.some((item) => item.id === selection.current) ? selection.current : items[0]?.id
	)

	const service = useMachine(tabs.machine, () => ({
		id,
		value,
		onValueChange: (details: tabs.ValueChangeDetails) => {
			selection.current = details.value
		},
	}))

	const api = $derived(tabs.connect(service, normalizeProps))
</script>

<div {...api.getRootProps()}>
	<!-- A strip holding one tab is chrome with nothing to switch between. -->
	{#if items.length > 1}
		<div
			{...api.getListProps()}
			class="border-medium bg-extralight flex gap-4 border-b px-2"
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
	{/if}

	{#each items as item (item.id)}
		<div
			{...api.getContentProps({ value: item.id })}
			class={[!item.transparent && 'bg-extralight px-2 pb-2']}
		>
			{@render item.content()}
		</div>
	{/each}
</div>
