<script lang="ts">
	import { Icon } from '@viamrobotics/prime-core'

	import Tooltip from '$lib/components/overlay/Tooltip.svelte'
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
			aria-label="Parent frames not found"
		>
			<Icon
				name="alert"
				size="xs"
			/>
		</span>
	{/snippet}

	{#snippet content()}
		<div class="font-public-sans flex flex-col gap-1.5">
			<p class="font-roboto-mono text-gray-4">Missing parent</p>

			<p>
				The parent frames these objects name are not found, so they are positioned relative to the
				world origin.
			</p>
		</div>
	{/snippet}
</Tooltip>
