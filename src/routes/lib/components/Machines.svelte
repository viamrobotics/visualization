<script lang="ts">
	import DashboardButton from '$lib/components/dashboard/Button.svelte'
	import { Input, Switch, Button, Icon, IconButton } from '@viamrobotics/prime-core'
	import * as floatingPanel from '@zag-js/floating-panel'
	import { normalizeProps, useMachine } from '@zag-js/svelte'
	import {
		useConnectionConfigs,
		useActiveConnectionConfig,
	} from '../hooks/useConnectionConfigs.svelte'
	import Collapsible from './Collapsible.svelte'

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

	const id = $props.id()
	const floatingPanelService = useMachine(floatingPanel.machine, () => ({
		id,
		defaultSize: { width: 700, height: 500 },
		resizable: false,
		open: isOpen,
	}))

	const api = $derived(floatingPanel.connect(floatingPanelService, normalizeProps))
</script>

<svelte:window {onpaste} />

<fieldset>
	<DashboardButton
		active
		icon="robot-outline"
		description="Machine connection configs"
		onclick={() => {
			isOpen = true
		}}
	/>
</fieldset>

<div {...api.getPositionerProps()}>
	<div
		{...api.getContentProps()}
		class="border-medium overflow-y-auto border-1 bg-white"
	>
		<div
			{...api.getDragTriggerProps()}
			class="sticky top-0 z-10 bg-white"
		>
			<div
				{...api.getHeaderProps()}
				class="border-medium flex justify-between border-b p-2"
			>
				<p
					{...api.getTitleProps()}
					class="text-xs"
				>
					Machine connection configs
				</p>
				<div
					{...api.getControlProps()}
					class="flex gap-3"
				>
					<button
						aria-label="Close connection configs panel"
						onclick={() => (isOpen = false)}
					>
						<Icon name="close" />
					</button>
				</div>
			</div>
		</div>

		<div {...api.getBodyProps()}>
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
		</div>
	</div>
</div>
