<script lang="ts">
	import { Button, Icon, IconButton, Input, Switch } from '@viamrobotics/prime-core'
	import { MachineConnectionEvent } from '@viamrobotics/sdk'

	import { WorkspacePortal } from '$lib'
	import Popover from '$lib/components/overlay/Popover.svelte'

	import {
		useActiveConnectionConfig,
		useConnectionConfigs,
	} from '../hooks/useConnectionConfigs.svelte'
	import { useMachineConnection } from '../hooks/useMachineConnection.svelte'
	import Collapsible from './Collapsible.svelte'

	interface Props {
		isOpen: boolean
	}

	let { isOpen = $bindable(false) }: Props = $props()

	const connectionConfigs = useConnectionConfigs()
	const activeConfig = useActiveConnectionConfig()
	const machineConnection = useMachineConnection()
	const connected = $derived(
		machineConnection.connectionStatus === MachineConnectionEvent.CONNECTED
	)
	const disconnected = $derived(
		machineConnection.connectionStatus === MachineConnectionEvent.DISCONNECTED ||
			machineConnection.connectionStatus === MachineConnectionEvent.RECONNECTION_FAILED
	)
	const text = $derived.by(() => {
		switch (machineConnection.connectionStatus) {
			case MachineConnectionEvent.CONNECTING:
			case MachineConnectionEvent.DIALING: {
				return 'connecting...'
			}
			case MachineConnectionEvent.RECONNECTING: {
				return 'reconnecting...'
			}
			case MachineConnectionEvent.CONNECTED: {
				return 'live'
			}
			case MachineConnectionEvent.DISCONNECTED:
			case MachineConnectionEvent.RECONNECTION_FAILED: {
				return 'offline'
			}
			default: {
				return 'connect'
			}
		}
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
			// A paste that does not parse as JSON is not a connection config, so ignore it.
		}
	}
</script>

<svelte:window {onpaste} />

<WorkspacePortal>
	<fieldset>
		<div class="text-default relative">
			<Popover
				placement="bottom-end"
				onOpenChange={(open) => {
					isOpen = open
				}}
			>
				{#snippet trigger(triggerProps, { isOpen: open })}
					{@const awaitingRetry = machineConnection.isAwaitingRetry}
					<div class="flex items-center">
						<!--
							zag resolves the popper anchor once, when the popover opens. Rendering the
							trigger from separate branches would detach that anchor on a status change
							and strand the open panel at the viewport edge, so keep one element.
						-->
						<button
							{...triggerProps}
							aria-label="Machine connection configs"
							class={[
								'flex items-center gap-2 border px-2.5 py-1.5 text-xs',
								awaitingRetry ? 'rounded-l border-r-0' : 'rounded',
								{
									'border-gray-5 bg-white': !awaitingRetry && !connected && !disconnected,
									'border-success-medium bg-success-light text-success-dark hover:bg-[#D6F2D9] focus:bg-[#D6F2D9]':
										!awaitingRetry && connected,
									'border-danger-medium bg-danger-light text-danger-dark hover:bg-[#F8E1DF] focus:bg-[#F8E1DF]':
										awaitingRetry || disconnected,
								},
							]}
						>
							<Icon name={awaitingRetry || disconnected ? 'broadcast-off' : 'broadcast'} />
							<span class={['truncate whitespace-nowrap', !awaitingRetry && 'capitalize']}>
								{awaitingRetry ? `Retry in ${machineConnection.secondsUntilRetry}s...` : text}
							</span>
							<Icon name="chevron-{open ? 'up' : 'down'}" />
						</button>

						{#if awaitingRetry}
							<button
								aria-label="Reconnect now"
								class="border-danger-medium bg-danger-light text-danger-dark flex items-center rounded-r border px-2 py-1.5 text-xs hover:bg-[#F8E1DF] focus:bg-[#F8E1DF]"
								onclick={machineConnection.retryNow}
							>
								<Icon name="refresh" />
							</button>
						{/if}
					</div>
				{/snippet}

				<div class="font-public-sans flex h-[400px] w-[480px] flex-col">
					<div class="flex min-h-0 grow flex-col gap-2 overflow-y-auto p-2">
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
											connectionConfigs.current[index].host = (
												event.target as HTMLInputElement
											).value
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
													connectionConfigs.current[index].partId = (
														event.target as HTMLInputElement
													).value
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

					<div class="border-medium flex w-full shrink-0 justify-center border-t bg-white p-2">
						<Button
							icon="plus"
							onclick={() => connectionConfigs.add()}
						>
							Add config
						</Button>
					</div>
				</div>
			</Popover>
		</div>
	</fieldset>
</WorkspacePortal>
