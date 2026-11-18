<script lang="ts">
	import { Icon } from '@viamrobotics/prime-core'

	import Tooltip from '$lib/components/overlay/Tooltip.svelte'
	import { poseStalenessSummary } from '$lib/hooks/poseStaleness/poseStalenessSummary'
	import { useResourceHealth } from '$lib/hooks/resources/useResourceHealth.svelte'

	const health = useResourceHealth()

	const summary = $derived(poseStalenessSummary(health.unhealthy))
</script>

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
			aria-label={summary}
		>
			<Icon
				name="alert"
				size="xs"
			/>
		</span>
	{/snippet}

	{#snippet content()}
		<div class="font-public-sans flex flex-col gap-1.5">
			<p class="font-medium">{summary}</p>

			{#if health.unhealthy.length > 0}
				<ul class="flex flex-col gap-1.5">
					{#each health.unhealthy as resource (resource.name)}
						<li>
							<span class="font-roboto-mono">{resource.name}</span>
							{#if resource.error}
								<span class="text-gray-4 block">{resource.error}</span>
							{/if}
						</li>
					{/each}
				</ul>
			{:else}
				<p class="text-gray-4">
					The machine stopped answering pose requests. The scene is showing the last poses returned.
				</p>
			{/if}
		</div>
	{/snippet}
</Tooltip>
