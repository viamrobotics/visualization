<script lang="ts">
	import { Select } from '@viamrobotics/prime-core'
	import { useMachineSettings } from '$lib/hooks/useMachineSettings.svelte'
	import type { Snippet } from 'svelte'

	interface Props {
		id: string
		label: string
		allowLive?: boolean
		children?: Snippet
	}

	let { id, label, allowLive = false, children }: Props = $props()

	const { refreshRates } = useMachineSettings()
	const rate = $derived(refreshRates.get(id))
</script>

<label class="flex flex-col gap-1">
	{label}
	<Select
		onchange={(event: InputEvent) => {
			if (event.target instanceof HTMLSelectElement) {
				const { value } = event.target
				refreshRates.set(id, Number.parseInt(value, 10))
			}
		}}
		value={String(rate ?? '')}
	>
		{#if children}
			{@render children()}
		{:else}
			<option value="-1">Do not fetch</option>
			<option value="0">Do not refresh</option>
			{#if allowLive}
				<option value="17">60fps</option>
				<option value="33">30fps</option>
			{/if}
			<option value="500">Refresh every 0.5 second</option>
			<option value="1000">Refresh every second</option>
			<option value="2000">Refresh every 2 seconds</option>
			<option value="5000">Refresh every 5 seconds</option>
			<option value="10000">Refresh every 10 seconds</option>
		{/if}
	</Select>
</label>

<style>
	label :global svg {
		display: none;
	}
</style>
