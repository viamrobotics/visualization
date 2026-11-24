<script lang="ts">
	import { untrack } from 'svelte'

	import DashboardButton from '#lib/components/overlay/dashboard/Button.svelte'
	import Popover from '#lib/components/overlay/Popover.svelte'
	import WorkspacePortal from '#lib/components/overlay/Portals/WorkspacePortal.svelte'
	import { traits, useQuery, useWorld } from '#lib/ecs/index.js'
	import { useEventBus } from '#lib/hooks/useEventBus.js'
	import { useResourceRowRenames } from '#lib/hooks/useResourceRowRenames.svelte.js'

	import { createLogIssueMirror } from './logIssueMirror'
	import LogPanel from './LogPanel.svelte'
	import { provideLogs } from './useLogs.svelte'

	const world = useWorld()
	const logs = provideLogs()
	const bus = useEventBus()

	// `.pre` so the subscription is in place before any plain `$effect` in the first flush
	// publishes, including the scene's own fetch notices.
	$effect.pre(() => {
		const stopDiagnostics = bus.subscribe('diagnostic', ({ message, level, target, source }) => {
			logs.add(message, level, target, source)
		})
		const stopClears = bus.subscribe('diagnostic-cleared', ({ source }) => {
			logs.retractSource(source)
		})

		return () => {
			stopDiagnostics()
			stopClears()
		}
	})

	const countByUuid = $derived(new Map(logs.current.map((log) => [log.uuid, log.count])))
	const issueMirror = createLogIssueMirror(world, (uuid) => countByUuid.get(uuid))

	// Repeats arrive at pose rate and change no row, so the mirror reruns only when the set of
	// alert lines does, or when a row it could mark spawns, despawns or is renamed.
	const alertSignature = $derived(
		logs.current
			.filter((log) => log.level !== 'info')
			.map((log) => log.uuid)
			.join('\0')
	)
	// Only rows a line can target, so world-state churn never reruns the mirror.
	const frameRows = useQuery(traits.Name, traits.FramesAPI)
	const framelessRows = useQuery(traits.Name, traits.FramelessComponent)
	const folderRows = useQuery(traits.Folder)
	const renames = useResourceRowRenames()

	$effect(() => {
		void alertSignature
		void renames.current
		void frameRows.current
		void framelessRows.current
		void folderRows.current
		untrack(() => issueMirror.apply(logs.current))
	})

	$effect(() => issueMirror.clear)

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
