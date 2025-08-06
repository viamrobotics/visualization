<script lang="ts">
	import { PersistedState } from 'runed'
	import {
		useConnectionConfigs,
		useActiveConnectionConfig,
	} from '../hooks/useConnectionConfigs.svelte'
	import { X, Radio } from 'lucide-svelte'

	const connectionConfigs = useConnectionConfigs()
	const activeConfig = useActiveConnectionConfig()

	let open = new PersistedState('machine-connection-config-open', false)

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

<button
	class=" fixed right-0 bottom-0 z-1000 p-2"
	type="button"
	onclick={() => (open.current = !open.current)}
>
	<Radio />
</button>

{#if open.current}
	<div class="fixed top-0 left-0 z-1010 grid h-full w-full place-content-center">
		<div
			class="border-medium flex h-full max-h-[500px] w-full max-w-[650px] items-start justify-between overflow-y-auto border bg-white p-2"
		>
			<div class="flex flex-col gap-2">
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

			<button onclick={() => (open.current = !open.current)}>
				<X />
			</button>
		</div>
	</div>
{/if}
