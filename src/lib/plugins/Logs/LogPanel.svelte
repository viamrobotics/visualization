<script lang="ts">
	import { Badge, Icon } from '@viamrobotics/prime-core'
	import { PersistedState, Throttled } from 'runed'

	import { useLogs } from './useLogs.svelte'

	const logs = useLogs()

	let levels = new PersistedState('logs-selected-levels', {
		info: true,
		warn: true,
		error: true,
	})

	/**
	 * At a live pose rate every repeating line re-renders its count 30–60 times a
	 * second. The store stays exact for the tree's alerts; only this list lags.
	 * Mounted only while the popover is open, so a closed panel reads nothing.
	 */
	const shown = new Throttled(() => logs.current, 250)

	const visible = $derived(shown.current.filter((log) => levels.current[log.level]))
</script>

<div class="font-public-sans flex max-h-[420px] w-80 flex-col overflow-y-auto overscroll-contain">
	<div class="border-light sticky top-0 z-1 flex items-center gap-1 border-b bg-white px-3 py-2">
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
			disabled={shown.current.length === 0}
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
			{#if shown.current.length === 0}
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
								<span class="bg-medium text-subtle-1 rounded-full px-1.5 leading-4 tabular-nums">
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
