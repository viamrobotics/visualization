<script lang="ts">
	import { mdiAlert } from '@mdi/js'
	import { Icon, Tooltip } from '@viamrobotics/prime-ui'

	import type { UnhealthyResource } from '#lib/hooks/resources/unhealthyResources.js'

	interface Props {
		/** The machine's report for this row's resource. */
		resource: UnhealthyResource
	}

	let { resource }: Props = $props()
</script>

<Tooltip
	interactive
	openDelay={150}
>
	<Tooltip.Trigger class="inline-flex items-center">
		<span
			class="bg-warning-bright flex size-4 shrink-0 items-center justify-center rounded-sm text-white"
			role="img"
			aria-label="{resource.name} is unhealthy"
		>
			<Icon
				icon={mdiAlert}
				size="xs"
			/>
		</span>
	</Tooltip.Trigger>

	<Tooltip.Content placement="right">
		<div class="font-public-sans flex flex-col gap-1.5">
			<p class="font-roboto-mono text-gray-4">{resource.name}</p>

			<p>The machine reports this resource as unhealthy.</p>

			{#if resource.error}
				<p class="text-gray-4">{resource.error}</p>
			{/if}
		</div>
	</Tooltip.Content>
</Tooltip>
