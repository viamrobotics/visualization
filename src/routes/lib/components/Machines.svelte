<script lang="ts">
	import {
		mdiBroadcast,
		mdiBroadcastOff,
		mdiChevronDown,
		mdiChevronRight,
		mdiChevronUp,
		mdiContentCopy,
		mdiPlus,
		mdiRefresh,
	} from '@mdi/js'
	import { TextField } from '@viamrobotics/prime-controls'
	import { Banner, Icon, Switch } from '@viamrobotics/prime-ui'
	import { MachineConnectionEvent } from '@viamrobotics/sdk'

	import { WorkspacePortal } from '#lib'
	import Popover from '#lib/components/overlay/Popover.svelte'

	import type { LaunchConfigState } from '../desktop/useLaunchConfig.svelte'

	import {
		useActiveConnectionConfig,
		useConnectionConfigs,
	} from '../hooks/useConnectionConfigs.svelte'
	import { useMachineConnection } from '../hooks/useMachineConnection.svelte'
	import AccountMachines from '../viamLogin/AccountMachines.svelte'
	import { useAccountPart } from '../viamLogin/useAccountPart.svelte'
	import { useViamSession } from '../viamLogin/useViamSession.svelte'
	import Collapsible from './Collapsible.svelte'

	interface Props {
		launch: LaunchConfigState
	}

	const { launch }: Props = $props()

	const connectionConfigs = useConnectionConfigs()
	const activeConfig = useActiveConnectionConfig()
	const machineConnection = useMachineConnection()
	const viamSession = useViamSession()
	const accountPart = useAccountPart()

	// Expanded by default only while logged out. Toggling overrides it until the session changes.
	let isManualOpen = $derived(viamSession.state.status !== 'active')

	const connected = $derived(
		machineConnection.connectionStatus === MachineConnectionEvent.CONNECTED
	)
	const disconnected = $derived(
		machineConnection.hasMachine &&
			(machineConnection.connectionStatus === MachineConnectionEvent.DISCONNECTED ||
				machineConnection.connectionStatus === MachineConnectionEvent.RECONNECTION_FAILED)
	)
	const text = $derived.by(() => {
		if (!machineConnection.hasMachine) {
			return 'connect'
		}

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
			<Popover placement="bottom-end">
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
							aria-label="Machine connection: {awaitingRetry
								? `retry in ${machineConnection.secondsUntilRetry}s`
								: text}"
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
							<Icon icon={awaitingRetry || disconnected ? mdiBroadcastOff : mdiBroadcast} />
							<span class={['truncate whitespace-nowrap', !awaitingRetry && 'capitalize']}>
								{awaitingRetry ? `Retry in ${machineConnection.secondsUntilRetry}s...` : text}
							</span>
							<Icon icon={open ? mdiChevronUp : mdiChevronDown} />
						</button>

						{#if awaitingRetry}
							<button
								aria-label="Reconnect now"
								class="border-danger-medium bg-danger-light text-danger-dark flex items-center rounded-r border px-2 py-1.5 text-xs hover:bg-[#F8E1DF] focus:bg-[#F8E1DF]"
								onclick={machineConnection.retryNow}
							>
								<Icon icon={mdiRefresh} />
							</button>
						{/if}
					</div>
				{/snippet}

				<div class="font-public-sans flex h-112 w-120 flex-col">
					<!--
						Not a scroller itself. The account machine list and the manual configs each fill the
						space left and scroll on their own, so no scroll area ever nests inside another.
					-->
					<div class="flex min-h-0 grow flex-col gap-2 p-2">
						{#if launch.error}
							<div
								role="alert"
								class="shrink-0"
							>
								<Banner variant="danger">
									<Banner.Description>Launch file: {launch.error}</Banner.Description>
								</Banner>
							</div>
						{/if}

						{#if machineConnection.hasMachine && machineConnection.error && !connected}
							<div
								role="alert"
								class="shrink-0"
							>
								<Banner variant="danger">
									<Banner.Description>
										Connection failed: {machineConnection.error?.message}
									</Banner.Description>
								</Banner>
							</div>
						{/if}

						{#if launch.current}
							<div class="border-medium flex shrink-0 flex-col gap-1 rounded border p-2 text-xs">
								<span class="text-heading font-medium">{launch.current.machineName}</span>
								<span class="text-default">{launch.current.partName}</span>
								<span class="text-subtle-1 font-roboto-mono">{launch.current.host}</span>
								<span class="text-subtle-2">Launched from the Viam CLI</span>
							</div>
						{/if}

						<AccountMachines isLaunched={!!launch.current} />

						<details
							class={[
								'group border-medium border-t pt-2',
								isManualOpen ? 'min-h-0 flex-1 overflow-y-auto' : 'shrink-0',
							]}
							open={isManualOpen}
							ontoggle={(event) => {
								isManualOpen = event.currentTarget.open
							}}
						>
							<summary
								class="text-subtle-1 hover:text-default flex cursor-pointer items-center gap-1 rounded px-1 py-1 text-xs focus-visible:outline-2"
							>
								<Icon
									icon={mdiChevronRight}
									class="group-open:rotate-90"
								/>
								Manual configs ({connectionConfigs.current.length})
							</summary>
							<div class="flex flex-col gap-2 pt-2">
								{#each connectionConfigs.current as config, index (config.host)}
									<form class="flex flex-col gap-2">
										<div class="flex justify-between gap-2">
											<Switch
												aria-label="Use {config.host}"
												disabled={!!launch.current}
												bind:checked={
													() => !launch.current && activeConfig.current?.partId === config.partId,
													(next) => {
														activeConfig.set(next ? index : undefined)
														if (next) accountPart.set(null)
													}
												}
											/>

											<TextField
												aria-label="Host"
												class="grow"
												placeholder="Host"
												value={config.host}
												onchange={(event) => {
													connectionConfigs.current[index].host = event.currentTarget.value
												}}
											/>

											{#if !connectionConfigs.isEnvConfig(config)}
												<button
													type="button"
													class="button button-compact"
													onclick={() => {
														connectionConfigs.remove(index)
													}}
												>
													Delete
												</button>
											{/if}

											<button
												type="button"
												class="icon-button button-ghost"
												aria-label="Copy config"
												onclick={() => {
													const data = connectionConfigs.current[index]
													navigator.clipboard.writeText(JSON.stringify(data))
												}}
											>
												<Icon icon={mdiContentCopy} />
											</button>
										</div>

										<Collapsible>
											<div class="grid grid-cols-3 items-center gap-2 pt-2">
												<label
													id="{config.host}-partId-label"
													for="{config.host}-partId"
													class="text-xs">Part ID</label
												>
												<TextField
													id="{config.host}-partId"
													aria-labelledby="{config.host}-partId-label"
													class="col-span-2"
													placeholder="Part ID"
													value={config.partId}
													onchange={(event) => {
														connectionConfigs.current[index].partId = event.currentTarget.value
													}}
												/>

												<label
													id="{config.host}-apiKeyId-label"
													for="{config.host}-apiKeyId"
													class="text-xs">API key ID</label
												>
												<TextField
													id="{config.host}-apiKeyId"
													aria-labelledby="{config.host}-apiKeyId-label"
													class="col-span-2"
													placeholder="API key ID"
													value={config.apiKeyId}
													onchange={(event) => {
														connectionConfigs.current[index].apiKeyId = event.currentTarget.value
													}}
												/>

												<label
													id="{config.host}-apiKeyValue-label"
													for="{config.host}-apiKeyValue"
													class="text-xs">API key value</label
												>
												<TextField
													id="{config.host}-apiKeyValue"
													aria-labelledby="{config.host}-apiKeyValue-label"
													class="col-span-2"
													placeholder="API key value"
													value={config.apiKeyValue}
													onchange={(event) => {
														connectionConfigs.current[index].apiKeyValue = event.currentTarget.value
													}}
												/>

												<label
													id="{config.host}-address-label"
													for="{config.host}-address"
													class="text-xs">Signaling address</label
												>
												<TextField
													id="{config.host}-address"
													aria-labelledby="{config.host}-address-label"
													class="col-span-2"
													placeholder="Signaling address"
													value={config.signalingAddress}
													onchange={(event) => {
														connectionConfigs.current[index].signalingAddress =
															event.currentTarget.value
													}}
												/>
											</div>
										</Collapsible>
									</form>

									<div class="mt-2 mb-2 w-full border-b border-gray-300"></div>
								{/each}

								<div class="flex justify-center">
									<button
										type="button"
										class="button button-compact"
										onclick={() => connectionConfigs.add()}
									>
										<Icon icon={mdiPlus} />
										Add config
									</button>
								</div>
							</div>
						</details>
					</div>
				</div>
			</Popover>
		</div>
	</fieldset>
</WorkspacePortal>
