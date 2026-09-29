<script lang="ts">
	import { Icon } from '@viamrobotics/prime-core'

	import type { UnhealthyResource } from '$lib/hooks/resources/unhealthyResources'

	import Tooltip from '$lib/components/overlay/Tooltip.svelte'

	interface Props {
		/** The machine's report for this row's resource. */
		resource: UnhealthyResource
	}

	let { resource }: Props = $props()
</script>

<!--
	Opens to the side, not below, and interactive: same reasoning as
	`LogStatusIndicator`, which marks the same rows.
-->
<Tooltip
	placement="right-start"
	interactive
	openDelay={150}
>
	{#snippet children(tooltipID)}
		<span
			class="bg-warning-bright flex size-4 shrink-0 items-center justify-center rounded-sm text-white"
			aria-describedby={tooltipID}
			role="img"
			aria-label="{resource.name} is unhealthy"
		>
			<Icon
				name="alert"
				size="xs"
			/>
		</span>
	{/snippet}

	{#snippet content()}
		<div class="font-public-sans flex flex-col gap-1.5">
			<p class="font-roboto-mono text-gray-4">{resource.name}</p>

			<p>The machine reports this resource as unhealthy.</p>

			{#if resource.error}
				<p class="text-gray-4">{resource.error}</p>
			{/if}
		</div>
	{/snippet}
</Tooltip>
