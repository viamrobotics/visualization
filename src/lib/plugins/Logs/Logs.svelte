<script lang="ts">
	import { Badge, Icon } from '@viamrobotics/prime-core'
	import { PersistedState } from 'runed'

	import DashboardButton from '$lib/components/overlay/dashboard/Button.svelte'
	import Popover from '$lib/components/overlay/Popover.svelte'
	import WorkspacePortal from '$lib/components/overlay/Portals/WorkspacePortal.svelte'
	import { usePartID } from '$lib/hooks/usePartID.svelte'

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

	let levels = new PersistedState('logs-selected-levels', {
		info: true,
		warn: true,
		error: true,
	})

	const visible = $derived(logs.current.filter((log) => levels.current[log.level]))

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

			<div
				class="font-public-sans flex max-h-[420px] w-80 flex-col overflow-y-auto overscroll-contain"
			>
				<div
					class="border-light sticky top-0 z-1 flex items-center gap-1 border-b bg-white px-3 py-2"
				>
					<button
						type="button"
						class="group cursor-pointer rounded-full"
						aria-pressed={levels.current.error}
						onclick={() => {
							levels.current.error = !levels.current.error
						}}
					>
						<Badge
							label="error"
							variant={levels.current.error ? 'danger' : 'inactive'}
							cx="transition group-hover:brightness-95"
						/>
					</button>

					<button
						type="button"
						class="group cursor-pointer rounded-full"
						aria-pressed={levels.current.warn}
						onclick={() => {
							levels.current.warn = !levels.current.warn
						}}
					>
						<Badge
							label="warn"
							variant={levels.current.warn ? 'warning' : 'inactive'}
							cx="transition group-hover:brightness-95"
						/>
					</button>

					<button
						type="button"
						class="group cursor-pointer rounded-full"
						aria-pressed={levels.current.info}
						onclick={() => {
							levels.current.info = !levels.current.info
						}}
					>
						<Badge
							label="info"
							variant={levels.current.info ? 'neutral' : 'inactive'}
							cx="transition group-hover:brightness-95"
						/>
					</button>

					<button
						type="button"
						aria-label="Clear all logs"
						disabled={logs.current.length === 0}
						class="text-subtle-2 hover:text-default hover:bg-ghost-light focus-visible:outline-gray-6 disabled:text-disabled ml-auto shrink-0 cursor-pointer rounded-xs p-1 transition-colors focus-visible:outline focus-visible:-outline-offset-1 disabled:cursor-default disabled:bg-transparent"
						onclick={() => {
							logs.clear()
						}}
					>
						<Icon
							name="trash-can-outline"
							size="sm"
						/>
					</button>
				</div>

				{#if visible.length === 0}
					<p class="text-subtle-2 px-3 py-6 text-center text-xs">
						{#if logs.current.length === 0}
							No logs yet.
						{:else}
							No logs at the selected levels.
						{/if}
					</p>
				{:else}
					<ul class="divide-gray-3 divide-y text-xs">
						{#each visible as log (log.uuid)}
							<li class="flex gap-2 px-3 py-2">
								<span
									class={[
										'mt-1 size-2 shrink-0 rounded-full',
										{
											'bg-danger-dark': log.level === 'error',
											'bg-warning-dark': log.level === 'warn',
											'bg-info-dark': log.level === 'info',
										},
									]}
									aria-hidden="true"
								></span>

								<div class="flex min-w-0 flex-col gap-0.5">
									<div class="text-subtle-2 flex flex-wrap items-center gap-1.5">
										<span>{log.timestamp}</span>

										{#if log.resource}
											<span class="font-roboto-mono text-subtle-1">{log.resource}</span>
										{/if}

										{#if log.count > 1}
											<!--
												The repeat count, so a message that fires every refresh tick
												occupies one row instead of scrolling the rest out of reach.
											-->
											<span
												class="bg-medium text-subtle-1 rounded-full px-1.5 leading-4 tabular-nums"
											>
												×{log.count}
											</span>
										{/if}
									</div>

									<span class="text-default wrap-break-word">{log.message}</span>
								</div>
							</li>
						{/each}
					</ul>
				{/if}
			</div>
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
