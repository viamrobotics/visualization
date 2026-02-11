<script lang="ts">
	import DashboardButton from '$lib/components/overlay/dashboard/Button.svelte'
	import { Input, Switch, Button, IconButton } from '@viamrobotics/prime-core'
	import {
		useConnectionConfigs,
		useActiveConnectionConfig,
	} from '../hooks/useConnectionConfigs.svelte'
	import Collapsible from './Collapsible.svelte'
	import FloatingPanel from '$lib/components/overlay/FloatingPanel.svelte'

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
	<DashboardButton
		active
		icon="robot-outline"
		description="Machine connection configs"
		onclick={() => {
			isOpen = !isOpen
		}}
	/>
</fieldset>

<FloatingPanel bind:isOpen>
	<div class="flex grow flex-col gap-2 overflow-y-auto p-2">
		{#each connectionConfigs.current as config, index (index)}
			<form class="flex flex-col gap-2">
				<div class="flex justify-between gap-2">
					<Switch
						on={activeConfig.current?.partId === config.partId}
						on:change={(event) => {
							activeConfig.set(event.detail ? index : undefined)
						}}
					/>

					<Input
						bind:value={config.host}
						class="input w-full grow text-xs"
						placeholder="Host"
					/>

					{#if !connectionConfigs.isEnvConfig(config)}
						<Button
							onclick={() => {
								connectionConfigs.remove(index)
							}}
						>
							Delete
						</Button>
					{/if}

					<IconButton
						icon="content-copy"
						label="Copy config"
						onclick={() => {
							const data = connectionConfigs.current[index]
							navigator.clipboard.writeText(JSON.stringify(data))
						}}
					/>
				</div>

				<Collapsible>
					<div class="grid grid-cols-3 items-center gap-2 pt-2">
						<label
							for="{config.host}-partId"
							class="text-xs">Part ID</label
						>
						<div class="col-span-2">
							<Input
								id="{config.host}-partId"
								bind:value={config.partId}
								placeholder="Part ID"
							/>
						</div>

						<label
							for="{config.host}-apiKeyId"
							class="text-xs">API key ID</label
						>
						<div class="col-span-2">
							<Input
								id="{config.host}-apiKeyId"
								bind:value={config.apiKeyId}
								placeholder="API key ID"
							/>
						</div>

						<label
							for="{config.host}-apiKeyValue"
							class="text-xs">API key value</label
						>
						<div class="col-span-2">
							<Input
								id="{config.host}-apiKeyValue"
								bind:value={config.apiKeyValue}
								placeholder="API key value"
							/>
						</div>

						<label
							for="{config.host}-address"
							class="text-xs">Signaling address</label
						>
						<div class="col-span-2">
							<Input
								id="{config.host}-address"
								bind:value={config.signalingAddress}
								placeholder="Signaling address"
							/>
						</div>
					</div>
				</Collapsible>
			</form>

			<div class="mt-2 mb-2 w-full border-b border-gray-300"></div>
		{/each}
	</div>

	<div class="border-medium flex w-full justify-center border-t bg-white p-2">
		<Button
			icon="plus"
			onclick={() => connectionConfigs.add()}
		>
			Add config
		</Button>
	</div>
</FloatingPanel>
