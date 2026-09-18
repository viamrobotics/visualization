<script lang="ts">
	import { Badge } from '@viamrobotics/prime-core'

	import Tooltip from '$lib/components/overlay/Tooltip.svelte'
	import { downloadProgress } from '$lib/hooks/sceneStaleness/downloadProgress'
	import { useSceneStaleness } from '$lib/hooks/useSceneStaleness.svelte'

	const staleness = useSceneStaleness()
</script>

{#if staleness.reason}
	<Tooltip
		placement="right-start"
		interactive
	>
		<Badge
			variant="progress"
			label={staleness.label}
			cx="shrink-0 whitespace-nowrap"
		/>

		<span class="sr-only">{staleness.summary}</span>

		{#snippet content()}
			<div class="flex flex-col gap-1.5">
				<p class="font-medium">{staleness.summary}</p>

				{#if staleness.installing.length > 0 || staleness.reconfiguring.length > 0}
					<ul class="flex flex-col gap-1.5">
						{#each staleness.installing as install (install.name)}
							{@const progress = downloadProgress(install.bytesDownloaded, install.totalBytes)}

							<li>
								<span class="font-roboto-mono">{install.name}</span>
								<span class="text-gray-4 block">
									{install.state}{progress === undefined ? '' : ` — ${progress}`}
								</span>
							</li>
						{/each}

						{#each staleness.reconfiguring as resource (resource.key)}
							<li>
								<span class="font-roboto-mono">{resource.name}</span>
								<span class="text-gray-4 block">{resource.state}</span>
							</li>
						{/each}
					</ul>
				{/if}
			</div>
		{/snippet}
	</Tooltip>
{/if}
