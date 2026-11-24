<script lang="ts">
	import RefreshRate from '#lib/components/overlay/RefreshRate.svelte'
	import { usePoses } from '#lib/hooks/usePoses.svelte.js'
	import { RefreshRates } from '#lib/hooks/useSettings.svelte.js'

	const poses = usePoses()
</script>

<div class="text-gray-9 flex flex-col gap-1 text-xs">
	<RefreshRate
		id={RefreshRates.poses}
		label="Pose refresh rate"
		onManualRefetch={() => {
			poses.refetch()
		}}
	/>
</div>
