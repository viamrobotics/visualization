<script lang="ts">
	import { Portal } from '@threlte/extras'
	import { useLogs } from '$lib/hooks/useLogs.svelte'
	import FloatingPanel from './FloatingPanel.svelte'
	import DashboardButton from './dashboard/Button.svelte'
	import { PersistedState } from 'runed'

	const logs = useLogs()

	const isOpen = new PersistedState('logs-is-open', false)
</script>

<Portal id="dashboard">
	<fieldset class="relative">
		<DashboardButton
			active
			icon="article"
			description="Logs"
			onclick={() => {
				isOpen.current = !isOpen.current
			}}
		/>
		{#if logs.warnings.length > 0}
			<span
				class="absolute z-4 -mt-1.5 -ml-1.5 h-4 w-4 rounded-full bg-yellow-700 text-center text-[10px] text-white"
			>
				{logs.warnings.length}
			</span>
		{/if}

		{#if logs.errors.length > 0}
			<span
				class="absolute z-4 -mt-1.5 -ml-1.5 h-4 rounded-full bg-red-700 px-1.25 text-center text-[10px] text-white"
			>
				{logs.errors.length}
			</span>
		{/if}
	</fieldset>
</Portal>

<FloatingPanel
	title="Logs"
	bind:isOpen={isOpen.current}
	defaultSize={{ width: 240, height: 315 }}
>
	<div class="flex h-70 flex-col gap-2 overflow-auto p-3 text-xs">
		{#each logs.current as log (log.uuid)}
			<div>
				<div class="flex flex-wrap items-center gap-1.5">
					<div
						class={[
							'h-2 w-2 rounded-full',
							{
								'bg-danger-dark': log.level === 'error',
								'bg-amber-300': log.level === 'warn',
								'bg-blue-400': log.level === 'info',
							},
						]}
					></div>
					<div class="text-subtle-2">{log.timestamp}</div>
				</div>
				<div>
					{#if log.count > 1}
						<span class="mr-1 rounded bg-green-700 px-1 py-0.5 text-xs text-white">
							{log.count}
						</span>
					{/if}
					{log.message}
				</div>
			</div>
		{:else}
			No logs
		{/each}
	</div>
</FloatingPanel>
