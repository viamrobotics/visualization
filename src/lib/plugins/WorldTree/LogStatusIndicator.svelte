<script lang="ts">
	import { mdiAlert, mdiAlertCircle } from '@mdi/js'
	import { Icon, Tooltip } from '@viamrobotics/prime-ui'

	import { type LogStatus, type LogTarget, useLogs } from '#lib/plugins/Logs/useLogs.svelte.js'

	interface Props {
		/** The row this marks, matched against what a log line was filed under. */
		target: LogTarget
		/** Row name, for the tooltip heading and the icon's accessible name. */
		label: string
		/** Worst level logged against `target`. Resolved by the row, which already reads it to decide whether to mount this. */
		status: LogStatus
	}

	let { target, label, status }: Props = $props()

	const logs = useLogs()
</script>

<!--
	Opens to the side, not below: the tree is a 240px panel of 32px rows, so a
	bottom-placed tooltip covers the rows underneath the one it is explaining.
	Interactive so a long message can be reached and copied.
-->
<Tooltip
	interactive
	openDelay={150}
>
	<Tooltip.Trigger class="inline-flex items-center">
		<span
			class={[
				'flex size-4 shrink-0 items-center justify-center rounded-sm text-white',
				status === 'error' ? 'bg-danger-bright' : 'bg-warning-bright',
			]}
			role="img"
			aria-label="{label} is reporting {status === 'error' ? 'errors' : 'warnings'}"
		>
			<Icon
				icon={status === 'error' ? mdiAlertCircle : mdiAlert}
				size="xs"
			/>
		</span>
	</Tooltip.Trigger>

	<Tooltip.Content placement="right">
		<!--
			Read here rather than in a component-level `$derived`: the content only
			renders while the tooltip is open, so a row costs nothing until it is hovered.
			Info lines are dropped, since the tooltip exists to explain the alert and the
			per-tick "Fetching..." lines would bury what raised it.
		-->
		{@const entries = logs.linesFor(target).filter((log) => log.level !== 'info')}

		<div class="font-public-sans flex flex-col gap-1.5">
			<p class="font-roboto-mono text-gray-4">{label}</p>

			<ul class="flex flex-col gap-1.5">
				{#each entries as log (log.uuid)}
					<li class="flex items-start gap-1.5">
						<span
							class={[
								'mt-1 size-1.5 shrink-0 rounded-full',
								log.level === 'error' ? 'bg-danger-bright' : 'bg-warning-bright',
							]}
							aria-hidden="true"
						></span>

						<span>
							{log.message}
							{#if log.count > 1}
								<span class="text-gray-4">×{log.count}</span>
							{/if}
						</span>
					</li>
				{/each}
			</ul>
		</div>
	</Tooltip.Content>
</Tooltip>
