<script lang="ts">
	import { useLogs } from '$lib/hooks/useLogs.svelte'
	import Drawer from './Drawer.svelte'

	const logs = useLogs()
</script>

<Drawer name="Logs">
	{#snippet titleAlert()}
		{#if logs.warnings.length > 0}
			<span class="mr-1 rounded bg-yellow-700 px-1 py-0.5 text-xs text-white">
				{logs.warnings.length}
			</span>
		{/if}

		{#if logs.errors.length > 0}
			<span class="mr-1 rounded bg-red-700 px-1 py-0.5 text-xs text-white">
				{logs.errors.length}
			</span>
		{/if}
	{/snippet}

	<div class="flex h-64 flex-col gap-2 overflow-auto p-3">
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
</Drawer>
