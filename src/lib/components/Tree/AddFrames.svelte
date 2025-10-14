<script lang="ts">
	import Drawer from './Drawer.svelte'
	import { useFrames } from '$lib/hooks/useFrames.svelte'
	import { usePartConfig } from '$lib/hooks/usePartConfig.svelte'

	const frames = useFrames()
	const partConfig = usePartConfig()
</script>

<Drawer name="Add Frames">
	<div class="flex h-64 w-60 flex-col gap-2 overflow-auto p-3">
		{#if frames.componentsWithNoFrame.length > 0}
			<ul class="space-y-1">
				{#each frames.componentsWithNoFrame as component (component)}
					<li class="text-sm text-gray-700">
						{component}
						<button
							class="focus:ring-opacity-50 ml-2 rounded bg-blue-500 px-2 py-1 text-xs text-white hover:bg-blue-600 focus:ring-2 focus:ring-blue-500 focus:outline-none"
							onclick={() => partConfig.createFrame(component)}>Add Frame</button
						>
					</li>
				{/each}
			</ul>
		{:else}
			No components without frames
		{/if}
	</div>
</Drawer>
