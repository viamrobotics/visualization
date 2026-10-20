<script lang="ts">
	import type { Snippet } from 'svelte'

	import { IconButton, Select } from '@viamrobotics/prime-core'

	import type { RefreshRateId } from '$lib/hooks/useSettings.svelte'

	import { useSettings } from '$lib/hooks/useSettings.svelte'

	import { refetchRateOptionsFor, RefetchRates } from './refetchRates'

	interface Props {
		id: RefreshRateId
		label: string
		onManualRefetch: () => void
		children?: Snippet
	}

	let { id, label, onManualRefetch, children }: Props = $props()

	const settings = useSettings()
	const { refreshRates } = $derived(settings.current)
	const rate = $derived(refreshRates[id] ?? RefetchRates.MANUAL)
	const options = $derived(refetchRateOptionsFor(id))
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
				{#each options as option (option.value)}
					<option value={String(option.value)}>{option.label}</option>
				{/each}
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
