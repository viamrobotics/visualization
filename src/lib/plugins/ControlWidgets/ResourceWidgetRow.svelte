<script lang="ts">
	import type { ResourceName } from '@viamrobotics/sdk'

	import { Icon, Switch } from '@viamrobotics/prime-core'
	import { PersistedState } from 'runed'

	import { usePartID } from '$lib/hooks/usePartID.svelte'

	import { resourceWidgetToggles } from './resourceWidgetToggles'
	import { useControlWidgets } from './useControlWidgets.svelte'

	interface Props {
		resource: ResourceName
	}

	const { resource }: Props = $props()

	const store = useControlWidgets()
	const partID = usePartID()

	const toggles = $derived(resourceWidgetToggles(resource))
	const enabledCount = $derived(
		toggles.filter((toggle) => store.isOpen(partID.current, resource.name, toggle.id)).length
	)

	const expanded = $derived(
		new PersistedState(`${partID.current}:${resource.name}:widgets-expanded`, false)
	)

	const setWidget = (widgetId: string, on: boolean) => {
		store.setOpen(partID.current, resource.name, widgetId, on)
	}
</script>

<div class="border-gray-3 border-b last:border-b-0">
	<button
		type="button"
		class="hover:bg-light flex w-full items-center gap-1.5 py-1 text-left"
		aria-expanded={expanded.current}
		onclick={() => (expanded.current = !expanded.current)}
	>
		<Icon
			name={expanded.current ? 'unfold-more-horizontal' : 'unfold-less-horizontal'}
			cx="text-subtle-1 size-5 shrink-0"
			aria-hidden="true"
		/>
		<span class="min-w-0 flex-1 truncate">{resource.name}</span>
		<span class="text-subtle-2 shrink-0 tabular-nums">{enabledCount}/{toggles.length}</span>
	</button>

	{#if expanded.current}
		<div class="flex flex-col gap-0.5 pb-1 pl-6">
			{#each toggles as toggle (toggle.id)}
				<div class="flex items-center justify-between gap-2 py-0.5">
					<span class="min-w-0 truncate">{toggle.label}</span>
					<Switch
						on={store.isOpen(partID.current, resource.name, toggle.id)}
						on:change={(event) => setWidget(toggle.id, event.detail)}
					/>
				</div>
			{/each}
		</div>
	{/if}
</div>
