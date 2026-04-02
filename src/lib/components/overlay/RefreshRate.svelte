<script
	module
	lang="ts"
>
	export const RefetchRates = {
		OFF: -1,
		MANUAL: 0,
		FPS_60: 17,
		FPS_30: 33,
		MS_500: 500,
		MS_1000: 1000,
		MS_2000: 2000,
		MS_5000: 5000,
		MS_10000: 10_000,
	} as const
</script>

<script lang="ts">
	import type { Snippet } from 'svelte'

	import { IconButton, Select } from '@viamrobotics/prime-core'

	import { useSettings } from '$lib/hooks/useSettings.svelte'

	interface Props {
		id: 'poses' | 'pointclouds' | 'vision'
		label: string
		allowLive?: boolean
		onManualRefetch: () => void
		children?: Snippet
	}

	let { id, label, allowLive = false, onManualRefetch, children }: Props = $props()

	const settings = useSettings()
	const { refreshRates } = $derived(settings.current)
	const rate = $derived(refreshRates[id] ?? RefetchRates.MANUAL)
</script>

<label class="flex flex-col gap-1">
	{label}
	<div class="flex items-center gap-1">
		<Select
			style="
				-webkit-appearance: none;
				-moz-appearance: none; 
				appearance: none; 
			"
			onchange={(event: InputEvent) => {
				if (event.target instanceof HTMLSelectElement) {
					const { value } = event.target
					refreshRates[id] = Number.parseInt(value, 10)
				}
			}}
			value={String(rate)}
		>
			{#if children}
				{@render children()}
			{:else}
				<option value={String(RefetchRates.OFF)}>Do not fetch</option>
				<option value={String(RefetchRates.MANUAL)}>Manual</option>
				{#if allowLive}
					<option value={String(RefetchRates.FPS_60)}>60fps</option>
					<option value={String(RefetchRates.FPS_30)}>30fps</option>
				{/if}
				<option value={String(RefetchRates.MS_500)}>Refresh every 0.5 second</option>
				<option value={String(RefetchRates.MS_1000)}>Refresh every second</option>
				<option value={String(RefetchRates.MS_2000)}>Refresh every 2 seconds</option>
				<option value={String(RefetchRates.MS_5000)}>Refresh every 5 seconds</option>
				<option value={String(RefetchRates.MS_10000)}>Refresh every 10 seconds</option>
			{/if}
		</Select>

		{#if rate === RefetchRates.MANUAL}
			<IconButton
				icon="refresh"
				label="refetch"
				variant="secondary"
				cx="border-light border"
				onclick={() => {
					onManualRefetch()
				}}
			/>
		{:else}
			<IconButton
				icon={rate === RefetchRates.OFF ? 'play-circle-outline' : 'pause'}
				label="pause"
				variant="secondary"
				cx="border-light border"
				onclick={() => {
					refreshRates[id] = RefetchRates.MANUAL
				}}
			/>
		{/if}
	</div>
</label>
