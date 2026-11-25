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
		/**
		 * Marks the tab with a dot, for something waiting there the user should know about while on
		 * another tab. The text is what a screen reader announces in place of the dot.
		 */
		indicatorLabel?: string
	}
</script>

<script lang="ts">
	import { Tabs } from '@viamrobotics/prime-ui'

	import { usePersistedStates } from '#lib/hooks/usePersistedStates.svelte.js'

	interface Props {
		/** Rendered left to right. The first one is selected until the user picks another. */
		items: DetailsTab[]
		/**
		 * Where the selected tab is remembered. Tab sets with different ids need different keys, or
		 * choosing a tab in one forgets the choice made in the other.
		 */
		storageKey?: string
	}

	const { items, storageKey = 'details-active-tab' }: Props = $props()

	const persistedState = usePersistedStates()
	const selection = $derived(persistedState<string | undefined>(storageKey, undefined))

	// Callers drop a tab when the entity has nothing to put in it, so a stale
	// selection has to fall back rather than leave every panel hidden.
	const value = $derived(
		items.some((item) => item.id === selection.current) ? selection.current : items[0]?.id
	)
</script>

<Tabs
	bind:value={
		() => value,
		(next) => {
			selection.current = next
		}
	}
>
	<!-- A strip holding one tab is chrome with nothing to switch between. -->
	{#if items.length > 1}
		<Tabs.List
			aria-label="Details sections"
			class="bg-white px-2"
		>
			{#each items as item (item.id)}
				<Tabs.Trigger value={item.id}>
					<!-- `text-xs` here, not on the trigger, since prime's `underline-tab` sets `text-sm` there. -->
					<span class="flex items-center gap-1 text-xs">
						{item.label}
						{#if item.indicatorLabel}
							<span
								class="bg-success-dark size-1.5 rounded-full"
								aria-hidden="true"
							></span>
							<span class="sr-only">({item.indicatorLabel})</span>
						{/if}
					</span>
				</Tabs.Trigger>
			{/each}
		</Tabs.List>
	{/if}

	{#each items as item (item.id)}
		<Tabs.Content
			value={item.id}
			class={[!item.transparent && 'bg-extralight px-2 pb-2']}
		>
			{@render item.content()}
		</Tabs.Content>
	{/each}
</Tabs>
