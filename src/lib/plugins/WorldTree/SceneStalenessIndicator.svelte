<script lang="ts">
	import { Badge } from '@viamrobotics/prime-core'

	import Tooltip from '$lib/components/overlay/Tooltip.svelte'
	import { downloadProgress } from '$lib/hooks/sceneStaleness/downloadProgress'
	import { useSceneStaleness } from '$lib/hooks/useSceneStaleness.svelte'

	const staleness = useSceneStaleness()
</script>

<!--
	The live region stays mounted so the notice is announced when it appears
	rather than being missed as a late insertion. `contents` keeps the empty
	wrapper from claiming a flex gap next to the panel controls.
-->
<div
	role="status"
	class="contents"
>
	{#if staleness.reason}
		<!--
			Opens to the side rather than below: the panel is docked left and only
			240px wide, so a bottom-placed tooltip covers the tree it is explaining.
		-->
		<Tooltip
			placement="right-start"
			interactive
		>
			<!--
				`progress` renders a spinner in place of an icon, which is the whole
				point: the label has to fit a 240px header beside the title, so the
				only room left to say "this resolves on its own" is the motion.
			-->
			<Badge
				variant="progress"
				label="Updating"
				cx="shrink-0 whitespace-nowrap"
			/>

			<!--
				The badge label has to stay short for a 240px header, so the summary
				naming what the scene is waiting on is what gets read out. The tooltip
				is hidden until hover, and hidden text is not exposed as a description.
			-->
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

							{#each staleness.reconfiguring as resource (resource.name)}
								<li>
									<span class="font-roboto-mono">{resource.name}</span>
									<span class="text-gray-4 block">{resource.state}</span>
								</li>
							{/each}
						</ul>
					{/if}

					<p class="text-gray-4">
						The scene redraws on its own once the machine finishes applying the configuration.
					</p>
				</div>
			{/snippet}
		</Tooltip>
	{/if}
</div>
