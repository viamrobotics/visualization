<script lang="ts">
	import { Portal } from '@threlte/extras'
	import { PersistedState } from 'runed'

	import { useLogs } from '$lib/hooks/useLogs.svelte'

	import DashboardButton from './dashboard/Button.svelte'
	import FloatingPanel from './FloatingPanel.svelte'

	const logs = useLogs()

	const isOpen = new PersistedState('logs-is-open', false)

	let levels = new PersistedState('logs-selected-levels', {
		info: true,
		warn: true,
		error: true,
	})
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
	resizable
>
	<div class="flex h-full flex-col">
		<div class="flex gap-1 px-3 py-2">
			<button
				type="button"
				class={[
					'chip border px-2',
					{
						'border-danger-dark bg-danger-dark text-white hover:border-red-700 hover:bg-red-700':
							levels.current.error,
						'bg-light hover:bg-ghost-light hover:border-light border-light text-subtle-1':
							!levels.current.error,
					},
				]}
				onclick={() => {
					levels.current.error = !levels.current.error
				}}
			>
				error
			</button>

			<button
				type="button"
				class={[
					'chip border',
					{
						'border-amber-400 bg-amber-400 text-white hover:border-amber-500 hover:bg-amber-500':
							levels.current.warn,
						'bg-light hover:bg-ghost-light hover:border-light border-light text-subtle-1':
							!levels.current.warn,
					},
				]}
				onclick={() => {
					levels.current.warn = !levels.current.warn
				}}
			>
				warn
			</button>

			<button
				type="button"
				class={[
					'chip border',
					{
						'border-blue-400 bg-blue-400 text-white hover:border-blue-500 hover:bg-blue-500':
							levels.current.info,
						'bg-light hover:bg-ghost-light hover:border-light border-light text-subtle-1':
							!levels.current.info,
					},
				]}
				onclick={() => {
					levels.current.info = !levels.current.info
				}}
			>
				info
			</button>
		</div>

		<div class="flex flex-col gap-2 overflow-auto px-3 pb-3 text-xs">
			{#each logs.current as log (log.uuid)}
				{#if levels.current[log.level]}
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
				{/if}
			{:else}
				No logs
			{/each}
		</div>
	</div>
</FloatingPanel>
