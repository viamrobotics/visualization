<script lang="ts">
	import { Badge } from '@viamrobotics/prime-core'
	import { useMachineStatus } from '@viamrobotics/svelte-sdk'

	import Tooltip from '$lib/components/overlay/Tooltip.svelte'
	import { poseStalenessSummary } from '$lib/hooks/poseStaleness/poseStalenessSummary'
	import { unhealthyResources } from '$lib/hooks/poseStaleness/unhealthyResources'
	import { usePartID } from '$lib/hooks/usePartID.svelte'
	import { usePoses } from '$lib/hooks/usePoses.svelte'

	const partID = usePartID()
	const poses = usePoses()
	const machineStatus = useMachineStatus(() => partID.current)

	const visible = $derived(poses.isStale)

	const unhealthy = $derived(unhealthyResources(machineStatus.current?.resources))
	const summary = $derived(poseStalenessSummary(unhealthy))
</script>

<!--
	The live region stays mounted so the warning is announced when it appears
	rather than being missed as a late insertion. `contents` keeps the empty
	wrapper from claiming a flex gap next to the panel controls.
-->
<div
	role="status"
	class="contents"
>
	{#if visible}
		<!--
			Opens to the side rather than below: the panel is docked left and only
			240px wide, so a bottom-placed tooltip covers the tree it is explaining.
		-->
		<Tooltip
			placement="right-start"
			interactive
		>
			<Badge
				variant="warning"
				icon="alert"
				label="Poses stale"
				cx="shrink-0 whitespace-nowrap"
			/>

			<!--
				The badge label has to stay short for a 240px header, so the summary
				naming the failing resource is what gets read out. The tooltip is
				hidden until hover, and hidden text is not exposed as a description.
			-->
			<span class="sr-only">{summary}</span>

			{#snippet content()}
				<div class="flex flex-col gap-1.5">
					<p class="font-medium">{summary}</p>

					{#if unhealthy.length > 0}
						<ul class="flex flex-col gap-1.5">
							{#each unhealthy as resource (resource.name)}
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
							The machine stopped answering pose requests. The scene is showing the last poses
							returned.
						</p>
					{/if}
				</div>
			{/snippet}
		</Tooltip>
	{/if}
</div>
