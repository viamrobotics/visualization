<script lang="ts">
	import Button from '$lib/components/dashboard/Button.svelte'
	import { Icon } from '@viamrobotics/prime-core'
	import {
		useConnectionConfigs,
		useActiveConnectionConfig,
	} from '../hooks/useConnectionConfigs.svelte'

	interface Props {
		isOpen: boolean
	}

	let { isOpen = $bindable(false) }: Props = $props()

	const connectionConfigs = useConnectionConfigs()
	const activeConfig = useActiveConnectionConfig()

	const onpaste = (event: ClipboardEvent) => {
		try {
			const config = JSON.parse(event.clipboardData?.getData('text') ?? '')

			if (
				'host' in config &&
				'partId' in config &&
				'apiKeyId' in config &&
				'apiKeyValue' in config &&
				'signalingAddress' in config
			) {
				connectionConfigs.current.push(config)
			}
		} catch {
			// Do nothing
		}
	}
</script>

<svelte:window {onpaste} />

<fieldset>
	<Button
		active
		icon="robot-outline"
		description="Machine connection configs"
		onclick={() => {
			isOpen = true
		}}
	/>
</fieldset>

{#if isOpen}
	<div class="fixed top-0 left-0 z-20 flex h-full w-full items-center justify-center">
		<button
			aria-label="Close"
			class="absolute h-full w-full bg-black/30"
			onclick={() => {
				isOpen = false
			}}
		></button>
		<div
			class="border-medium z-1 flex h-full max-h-2/3 w-[95%] max-w-[650px] flex-col items-start justify-between border bg-white shadow-2xl"
		>
			<div class=" border-gray-3 flex w-full justify-between border-b p-2">
				<h3 class="text-subtle-1">Machine connection configs</h3>
				<button
					onclick={() => {
						isOpen = !isOpen
					}}
				>
					<Icon name="close" />
				</button>
			</div>

			<div class="flex grow flex-col gap-2 overflow-y-auto p-2">
				{#each connectionConfigs.current as config, index (index)}
					<form class="flex flex-wrap items-center gap-2">
						<label class="label flex items-center gap-1.5 text-xs">
							<input
								class="checkbox"
								type="checkbox"
								checked={activeConfig.current?.partId === config.partId}
								onchange={(event) => {
									const { checked } = event.target as HTMLInputElement
									activeConfig.set(checked ? index : undefined)
								}}
							/>
							Active
						</label>

						<input
							bind:value={config.host}
							class="input max-w-72 text-xs"
							placeholder="Host"
						/>
						<input
							bind:value={config.partId}
							class="input max-w-72 text-xs"
							placeholder="Part ID"
						/>
						<input
							bind:value={config.apiKeyId}
							class="input max-w-72 text-xs"
							placeholder="API Key ID"
						/>
						<input
							bind:value={config.apiKeyValue}
							class="input max-w-72 text-xs"
							placeholder="API Key Value"
						/>
						<input
							bind:value={config.signalingAddress}
							class="input max-w-72 text-xs"
							placeholder="Signaling Address"
						/>
						{#if !connectionConfigs.isEnvConfig(config)}
							<button
								type="button"
								class="btn preset-filled p-2 text-xs"
								onclick={() => {
									connectionConfigs.remove(index)
								}}
							>
								Delete
							</button>
						{/if}

						<button
							type="button"
							class="btn preset-filled p-2 text-xs"
							onclick={() => {
								const data = connectionConfigs.current[index]
								navigator.clipboard.writeText(JSON.stringify(data))
							}}
						>
							Copy
						</button>
					</form>

					<div class="mt-2 mb-4 w-full border-b border-gray-300"></div>
				{/each}

				<button
					type="button"
					class="btn preset-filled"
					onclick={() => connectionConfigs.add()}>Add config</button
				>
			</div>
		</div>
	</div>
{/if}
