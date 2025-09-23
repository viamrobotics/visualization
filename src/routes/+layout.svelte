<script lang="ts">
	import '../app.css'

	import type { DialConf } from '@viamrobotics/sdk'
	import { ViamAppProvider, ViamProvider } from '@viamrobotics/svelte-sdk'
	import { MotionTools } from '$lib'
	import {
		provideConnectionConfigs,
		useActiveConnectionConfig,
	} from './lib/hooks/useConnectionConfigs.svelte'
	import Machines from './lib/components/Machines.svelte'
	import { getDialConfs } from './lib/robots'
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

<ViamAppProvider
	serviceHost="https://app.viam.com"
	credentials={{
		type: 'api-key',
		payload: 'g70dv014fq3fe4qtfs7f6l99xeufmu2l',
		authEntity: 'b6c1c558-aac2-4f52-9a17-b5d6cf9df5f7',
	}}
>
	<ViamProvider
		{dialConfigs}
		{client}
	>
		<MotionTools
			{partID}
			enableKeybindings={!isMachinesPageOpen}
		>
			{@render children()}
		</MotionTools>
	</ViamProvider>
</ViamAppProvider>
