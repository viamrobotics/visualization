<script lang="ts">
	import DashboardButton from '$lib/components/overlay/dashboard/Button.svelte'
	import Popover from '$lib/components/overlay/Popover.svelte'
	import WorkspacePortal from '$lib/components/overlay/Portals/WorkspacePortal.svelte'
	import { usePartID } from '$lib/hooks/usePartID.svelte'

	import LogPanel from './LogPanel.svelte'
	import { provideLogs } from './useLogs.svelte'

	const logs = provideLogs()
	const partID = usePartID()

	// The sink lives as long as the app, so nothing else evicts the previous
	// machine's lines. Seeded at setup rather than left unset so the first flush
	// keeps what plugins mounting alongside us have already logged.
	let loggedPartID = partID.current

	$effect(() => {
		const next = partID.current
		const previous = loggedPartID
		loggedPartID = next

		// Leaving no machine at all is not a machine change. Lines filed before an
		// id resolved, by the draw service or a failed connection, are still current.
		if (previous === '' || previous === next) return

		logs.clear()
	})

	/**
	 * One badge, not two stacked in the same corner. Errors outrank warnings, so
	 * that count is what the button carries when both are present.
	 */
	const alert = $derived.by(() => {
		const { errorCount, warnCount } = logs
		if (errorCount > 0) {
			return {
				count: errorCount,
				class: 'bg-danger-dark',
				label: `${errorCount} ${errorCount === 1 ? 'error' : 'errors'} logged`,
			}
		}
		if (warnCount > 0) {
			return {
				count: warnCount,
				class: 'bg-warning-dark',
				label: `${warnCount} ${warnCount === 1 ? 'warning' : 'warnings'} logged`,
			}
		}
		return undefined
	})
</script>

<WorkspacePortal>
	<fieldset class="relative">
		<Popover placement="bottom-end">
			{#snippet trigger(triggerProps, { isOpen })}
				<DashboardButton
					{...triggerProps}
					active={isOpen}
					icon="article"
					description="Logs"
				/>
			{/snippet}

			<LogPanel />
		</Popover>

		{#if alert}
			<span
				role="status"
				aria-label={alert.label}
				class={[
					'absolute z-4 -mt-1.5 -ml-1.5 h-4 min-w-4 rounded-full px-1 text-center text-[10px] leading-4 text-white tabular-nums',
					alert.class,
				]}
			>
				{alert.count}
			</span>
		{/if}
	</fieldset>
</WorkspacePortal>
