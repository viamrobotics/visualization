<script lang="ts">
	import type { ResourceName } from '@viamrobotics/sdk'

	import { usePartID } from '$lib/hooks/usePartID.svelte'

	import { resourceWidgetToggles } from './resourceWidgetToggles'

	interface Props {
		resource: ResourceName
	}

	const { resource }: Props = $props()

	const partID = usePartID()

	const toggles = $derived(resourceWidgetToggles(resource))
</script>

<div class="flex max-h-[60vh] flex-col gap-3 overflow-y-auto overscroll-contain pt-3 text-xs">
	{#each toggles as toggle (toggle.id)}
		<section
			class="flex flex-col gap-2"
			aria-label={toggle.label}
		>
			<h3 class="text-subtle-2">{toggle.label}</h3>

			{#each toggle.widgets as Widget, index (index)}
				<Widget
					partID={partID.current}
					resourceName={resource.name}
				/>
			{/each}
		</section>
	{/each}
</div>
