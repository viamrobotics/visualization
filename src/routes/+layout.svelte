<script lang="ts">
	import '../app.css'

	import type { DialConf } from '@viamrobotics/sdk'
	import { ViamProvider, ViamAppProvider } from '@viamrobotics/svelte-sdk'
	import { MotionTools } from '$lib'
	import {
		provideConnectionConfigs,
		useActiveConnectionConfig,
	} from './lib/hooks/useConnectionConfigs.svelte'
	import Machines from './lib/components/Machines.svelte'
	import { getDialConfs } from './lib/robots'
	import { backendIP, websocketPort } from '$lib/defines'

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

	let isMachinesPageOpen = $state(false)
</script>

<ViamProvider
	config={{
		defaultOptions: {
			queries: {
				staleTime: Infinity,
			},
		},
	}}
	{dialConfigs}
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
				drawConnectionConfig={{ backendIP, websocketPort }}
			>
				{@render children()}

				{#snippet dashboard()}
					<Machines bind:isOpen={isMachinesPageOpen} />
				{/snippet}
			</MotionTools>
		</ViamAppProvider>
	{:else}
		<MotionTools
			{partID}
			enableKeybindings={!isMachinesPageOpen}
			drawConnectionConfig={{ backendIP, websocketPort }}
		>
			{@render children()}

			{#snippet dashboard()}
				<Machines bind:isOpen={isMachinesPageOpen} />
			{/snippet}
		</MotionTools>
	{/if}
</ViamProvider>
