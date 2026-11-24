<script lang="ts">
	import type { Entity } from 'koota'

	import SectionNotice from '#lib/components/overlay/details/SectionNotice.svelte'
	import SettingsPortal from '#lib/components/overlay/Portals/SettingsPortal.svelte'
	import { traits } from '#lib/ecs/index.js'
	import { useDetailsSection } from '#lib/hooks/useDetailsSections.svelte.js'
	import { useEnvironment } from '#lib/hooks/useEnvironment.svelte.js'
	import { useResourceByName } from '#lib/hooks/useResourceByName.svelte.js'

	import ResourceTestTab from './ResourceTestTab.svelte'
	import ResourceWidgetList from './ResourceWidgetList.svelte'
	import ResourceWidgetPanel from './ResourceWidgetPanel.svelte'
	import { resourceWidgetToggles } from './resourceWidgetToggles'
	import { useResourceWidgets } from './useResourceWidgets.svelte'

	const environment = useEnvironment()
	const resolved = useResourceWidgets()
	const resourceByName = useResourceByName()

	const resourceOf = (entity: Entity) => {
		const name = entity.get(traits.Name)
		return name ? resourceByName.current[name] : undefined
	}

	useDetailsSection({
		snippet: testTab,
		label: 'test',
		when: (entity) => {
			const resource = resourceOf(entity)
			return resource !== undefined && resourceWidgetToggles(resource).length > 0
		},
		tab: 'test',
	})
</script>

{#snippet testTab({ entities }: { entities: readonly Entity[] })}
	{@const resource = entities.length === 1 ? resourceOf(entities[0]) : undefined}

	{#if resource}
		<ResourceTestTab {resource} />
	{:else}
		<div class="pt-3">
			<SectionNotice
				label="test"
				message="Select a single resource to test it."
			/>
		</div>
	{/if}
{/snippet}

<SettingsPortal label="Widgets">
	<ResourceWidgetList />
</SettingsPortal>

<!-- Registry widget panels render only outside XR. -->
{#if !environment.current.isImmersive}
	{#each resolved.current as widget, stackIndex (widget.key)}
		<ResourceWidgetPanel
			resource={widget.resource}
			widgetId={widget.widgetId}
			widgets={widget.widgets}
			title={`${widget.resource.name} · ${widget.label}`}
			{stackIndex}
		/>
	{/each}
{/if}
