<script lang="ts">
	import { Switch } from '@viamrobotics/prime-core'
	import { onMount } from 'svelte'

	import { useWeblabs, WEBLABS_EXPERIMENTS } from '$lib/hooks/useWeblabs.svelte'

	const weblabs = useWeblabs()
	const knownWeblabs = Object.keys(WEBLABS_EXPERIMENTS)

	onMount(() => {
		weblabs.load(knownWeblabs)
	})
</script>

<div class="flex flex-col gap-1 text-xs">
	{#each knownWeblabs as experiment (experiment)}
		<label class="flex items-center justify-between gap-2 py-0.5">
			{experiment}
			<Switch
				on={weblabs.isActive(experiment)}
				on:change={() => weblabs.toggle(experiment)}
			/>
		</label>
	{:else}
		No weblabs defined
	{/each}
</div>
