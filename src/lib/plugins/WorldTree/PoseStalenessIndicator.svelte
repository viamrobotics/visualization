<script lang="ts">
	import { mdiAlert } from '@mdi/js'
	import { Icon, Tooltip } from '@viamrobotics/prime-ui'

	import { poseStalenessSummary } from '#lib/hooks/poseStaleness/poseStalenessSummary.js'
	import { useResourceHealth } from '#lib/hooks/resources/useResourceHealth.svelte.js'

	const health = useResourceHealth()

	const summary = $derived(poseStalenessSummary(health.unhealthy))
</script>

<Tooltip
	interactive
	openDelay={150}
>
	<Tooltip.Trigger class="inline-flex items-center">
		<span
			class="bg-warning-bright flex size-4 shrink-0 items-center justify-center rounded-sm text-white"
			role="img"
			aria-label={summary}
		>
			<Icon
				icon={mdiAlert}
				size="xs"
			/>
		</span>
	</Tooltip.Trigger>

	<Tooltip.Content side="right">
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
	</Tooltip.Content>
</Tooltip>
