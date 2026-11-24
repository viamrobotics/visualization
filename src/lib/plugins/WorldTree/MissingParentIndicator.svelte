<script lang="ts">
	import { mdiAlert } from '@mdi/js'
	import { Icon, Tooltip } from '@viamrobotics/prime-ui'
</script>

<Tooltip
	interactive
	openDelay={150}
>
	<Tooltip.Trigger class="inline-flex items-center">
		<span
			class="bg-warning-bright flex size-4 shrink-0 items-center justify-center rounded-sm text-white"
			role="img"
			aria-label="Parent frames not found"
		>
			<Icon
				icon={mdiAlert}
				size="xs"
			/>
		</span>
	</Tooltip.Trigger>

	<Tooltip.Content placement="right">
		<div class="font-public-sans flex flex-col gap-1.5">
			<p class="font-roboto-mono text-gray-4">Missing parent</p>

			<p>
				The parent frames these objects name are not found, so they are positioned relative to the
				world origin.
			</p>
		</div>
	</Tooltip.Content>
</Tooltip>
