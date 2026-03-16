<script lang="ts">
	import { IconButton } from '@viamrobotics/prime-core'

	import { useFramelessComponents } from '$lib/hooks/useFramelessComponents.svelte'
	import { usePartConfig } from '$lib/hooks/usePartConfig.svelte'

	import Drawer from './Drawer.svelte'

	const framelessComponents = useFramelessComponents()
	const partConfig = usePartConfig()
</script>

<Drawer name="Add frames">
	<div class="flex max-h-64 flex-col gap-2 overflow-auto p-3">
		{#if framelessComponents.current.length > 0}
			<ul class="space-y-1">
				{#each framelessComponents.current as component (component)}
					<li class="flex items-center gap-2 text-xs text-gray-700">
						{component}
						<IconButton
							label="Add frame"
							icon="plus"
							onclick={() => partConfig.createFrame(component)}
						/>
					</li>
				{/each}
			</ul>
		{:else}
			No components without frames
		{/if}
	</div>
</Drawer>
