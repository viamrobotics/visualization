<script lang="ts">
	import type { DialConf } from '@viamrobotics/sdk'
	import { ViamProvider, ViamAppProvider } from '@viamrobotics/svelte-sdk'
	import { MotionTools } from '$lib'
	import {
		provideConnectionConfigs,
		useActiveConnectionConfig,
	} from '../lib/hooks/useConnectionConfigs.svelte'
	import Machines from '../lib/components/Machines.svelte'
	import { getDialConfs } from '../lib/robots'
	import { QueryClient } from '@tanstack/svelte-query'

	provideConnectionConfigs()

	const connectionConfig = useActiveConnectionConfig()

	let { children } = $props()

	let dialConfigs = $derived.by<Record<string, DialConf>>(() => {
		if (connectionConfig.current) {
			const robot = {
				...$state.snapshot(connectionConfig.current),
				disableSessions: true,
			}

			return { ...getDialConfs({ robot }) }
		}

		return {}
	})

	const partID = $derived(connectionConfig.current?.partId)

	const client = new QueryClient({
		defaultOptions: {
			queries: {
				staleTime: Infinity,
			},
		},
	})

	let isMachinesPageOpen = $state(false)
</script>

<Machines bind:isOpen={isMachinesPageOpen} />

<ViamProvider
	{dialConfigs}
	{client}
>
	{#if connectionConfig.current}
		<ViamAppProvider
			serviceHost="https://app.viam.com"
			credentials={{
				type: 'api-key',
				payload: connectionConfig.current.apiKeyValue,
				authEntity: connectionConfig.current.apiKeyId,
			}}
		>
			<MotionTools
				{partID}
				enableKeybindings={!isMachinesPageOpen}
			>
				{@render children()}
			</MotionTools>
		</ViamAppProvider>
	{:else}
		<MotionTools
			{partID}
			enableKeybindings={!isMachinesPageOpen}
		>
			{@render children()}
		</MotionTools>
	{/if}
</ViamProvider>
