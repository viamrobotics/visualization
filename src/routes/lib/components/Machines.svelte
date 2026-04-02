<script lang="ts">
	import { Button, Icon, IconButton, Input, Switch } from '@viamrobotics/prime-core'
	import { MachineConnectionEvent } from '@viamrobotics/sdk'
	import { useConnectionStatus } from '@viamrobotics/svelte-sdk'

	import FloatingPanel from '$lib/components/overlay/FloatingPanel.svelte'
	import { usePartID } from '$lib/hooks/usePartID.svelte'

	import {
		useActiveConnectionConfig,
		useConnectionConfigs,
	} from '../hooks/useConnectionConfigs.svelte'
	import Collapsible from './Collapsible.svelte'

	interface Props {
		isOpen: boolean
	}

	let { isOpen = $bindable(false) }: Props = $props()

	const connectionConfigs = useConnectionConfigs()
	const activeConfig = useActiveConnectionConfig()
	const partID = usePartID()
	const connectionStatus = useConnectionStatus(() => partID.current)
	const connected = $derived(connectionStatus.current === MachineConnectionEvent.CONNECTED)
	const disconnected = $derived(connectionStatus.current === MachineConnectionEvent.DISCONNECTED)
	const text = $derived.by(() => {
		if (connectionStatus.current === MachineConnectionEvent.CONNECTING) {
			return 'connecting...'
		}

		if (connectionStatus.current === MachineConnectionEvent.CONNECTED) {
			return 'live'
		}

		if (connectionStatus.current === MachineConnectionEvent.DISCONNECTED) {
			return 'offline'
		}

		return 'connect'
	})

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
				connectionConfigs.add(config)
			}
		} catch {
			// Do nothing
		}
	}
</script>

<svelte:window {onpaste} />

<fieldset>
	<div class="text-default relative">
		<div class="flex items-center">
			<button
				aria-label="Machine connection configs"
				class={[
					'flex items-center gap-2 border px-2.5 py-1.5 text-xs ',
					{
						'border-gray-5 bg-white': !connected && !disconnected,
						'border-success-medium bg-success-light text-success-dark hover:bg-[#D6F2D9] focus:bg-[#D6F2D9]':
							connected,
						'border-danger-medium bg-danger-light text-danger-dark hover:bg-[#F8E1DF] focus:bg-[#F8E1DF]':
							disconnected,
					},
				]}
				onclick={() => {
					isOpen = !isOpen
				}}
			>
				<Icon name={disconnected ? 'broadcast-off' : 'broadcast'} />
				<span class="truncate whitespace-nowrap capitalize">{text}</span>
				<Icon name="chevron-{isOpen ? 'up' : 'down'}" />
			</button>
		</div>
	</div>
</fieldset>

<FloatingPanel
	title="Connection configurations"
	defaultSize={{ width: 480, height: 400 }}
	bind:isOpen
>
	<div class="flex h-full grow flex-col gap-2 overflow-y-auto p-2">
		{#each connectionConfigs.current as config, index (config.host)}
			<form class="flex flex-col gap-2">
				<div class="flex justify-between gap-2">
					<Switch
						on={activeConfig.current?.partId === config.partId}
						on:change={(event) => {
							activeConfig.set(event.detail ? index : undefined)
						}}
					/>

					<Input
						class="input w-full grow text-xs"
						placeholder="Host"
						value={config.host}
						on:change={(event) => {
							connectionConfigs.current[index].host = (event.target as HTMLInputElement).value
						}}
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
								placeholder="Part ID"
								value={config.partId}
								on:change={(event) => {
									connectionConfigs.current[index].partId = (event.target as HTMLInputElement).value
								}}
							/>
						</div>

						<label
							for="{config.host}-apiKeyId"
							class="text-xs">API key ID</label
						>
						<div class="col-span-2">
							<Input
								id="{config.host}-apiKeyId"
								placeholder="API key ID"
								value={config.apiKeyId}
								on:change={(event) => {
									connectionConfigs.current[index].apiKeyId = (
										event.target as HTMLInputElement
									).value
								}}
							/>
						</div>

						<label
							for="{config.host}-apiKeyValue"
							class="text-xs">API key value</label
						>
						<div class="col-span-2">
							<Input
								id="{config.host}-apiKeyValue"
								placeholder="API key value"
								value={config.apiKeyValue}
								on:change={(event) => {
									connectionConfigs.current[index].apiKeyValue = (
										event.target as HTMLInputElement
									).value
								}}
							/>
						</div>

						<label
							for="{config.host}-address"
							class="text-xs">Signaling address</label
						>
						<div class="col-span-2">
							<Input
								id="{config.host}-address"
								placeholder="Signaling address"
								value={config.signalingAddress}
								on:change={(event) => {
									connectionConfigs.current[index].signalingAddress = (
										event.target as HTMLInputElement
									).value
								}}
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
