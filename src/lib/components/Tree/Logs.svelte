<script lang="ts">
	import { useFrames } from '$lib/hooks/useFrames.svelte'
	import { useGeometries } from '$lib/hooks/useGeometries.svelte'
	import { useLogs } from '$lib/hooks/useLogs.svelte'
	import { usePointClouds } from '$lib/hooks/usePointclouds.svelte'
	import Drawer from './Drawer.svelte'

	const frames = useFrames()
	const geometries = useGeometries()
	const pointclouds = usePointClouds()
	const logs = useLogs()

	$effect(() => {
		if (frames.error) {
			const message = `Frames: ${frames.error.message}`
			logs.add(message, 'error')
		}
	})

	$effect(() => {
		if (geometries.errors.length > 0) {
			for (const error of geometries.errors) {
				logs.add(`Geometries: ${error.message}`, 'error')
			}
		}
	})

	$effect(() => {
		if (pointclouds.errors.length > 0) {
			for (const error of pointclouds.errors) {
				logs.add(`Pointclouds: ${error.message}`, 'error')
			}
		}
	})
</script>

<Drawer name="Logs">
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
						<span class="mr-1 rounded bg-green-700 px-1 py-0.5 text-xs text-white!">
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
