<script lang="ts">
	import { mdiPause, mdiPlayCircleOutline, mdiRefresh } from '@mdi/js'
	import { Select } from '@viamrobotics/prime-controls'
	import { Icon } from '@viamrobotics/prime-ui'

	import type { RefreshRateId } from '#lib/hooks/useSettings.svelte.js'

	import { useSettings } from '#lib/hooks/useSettings.svelte.js'

	import { refetchRateOptionsFor, RefetchRates } from './refetchRates'

	interface Props {
		id: RefreshRateId
		label: string
		onManualRefetch: () => void
	}

	let { id, label, onManualRefetch }: Props = $props()

	const labelId = $props.id()

	const settings = useSettings()
	const { refreshRates } = $derived(settings.current)
	const rate = $derived(refreshRates[id] ?? RefetchRates.MANUAL)
	const items = $derived(
		refetchRateOptionsFor(id).map((option) => ({
			value: String(option.value),
			label: option.label,
		}))
	)
</script>

<div class="flex flex-col gap-1">
	<span id={labelId}>{label}</span>
	<div class="flex items-center gap-1">
		<Select
			{items}
			bind:value={
				() => String(rate),
				(next) => {
					refreshRates[id] = Number.parseInt(next, 10)
				}
			}
		>
			<Select.Trigger
				aria-labelledby={labelId}
				class="min-w-0 flex-1"
			>
				<Select.Value />
			</Select.Trigger>
			<Select.Content>
				<Select.Viewport>
					<Select.Items />
				</Select.Viewport>
			</Select.Content>
		</Select>

		{#if rate === RefetchRates.MANUAL}
			<button
				type="button"
				class="icon-button button-ghost"
				aria-label="Refetch now"
				onclick={() => {
					onManualRefetch()
				}}
			>
				<Icon icon={mdiRefresh} />
			</button>
		{:else}
			<button
				type="button"
				class="icon-button button-ghost"
				aria-label={rate === RefetchRates.OFF ? 'Turn on manual fetching' : 'Pause polling'}
				onclick={() => {
					refreshRates[id] = RefetchRates.MANUAL
				}}
			>
				<Icon icon={rate === RefetchRates.OFF ? mdiPlayCircleOutline : mdiPause} />
			</button>
		{/if}
	</div>
</div>
