<script lang="ts">
	import '../app.css'

	import type { DialConf } from '@viamrobotics/sdk'

	import { ViamAppProvider, ViamProvider } from '@viamrobotics/svelte-sdk'

	import { MotionTools } from '$lib'
	import { backendIP, websocketPort } from '$lib/defines'

	import Machines from './lib/components/Machines.svelte'
	import {
		provideConnectionConfigs,
		useActiveConnectionConfig,
	} from './lib/hooks/useConnectionConfigs.svelte'
	import { getDialConfs } from './lib/robots'

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
	<ViamAppProvider
		serviceHost="https://app.viam.com"
		credentials={{
			type: 'api-key',
			payload: connectionConfig.current?.apiKeyValue ?? '',
			authEntity: connectionConfig.current?.apiKeyId ?? '',
		}}
	>
		<MotionTools
			{partID}
			inputBindingsEnabled={!isMachinesPageOpen}
			drawConnectionConfig={{ backendIP, websocketPort }}
		>
			{@render children()}

			{#snippet dashboard()}
				<Machines bind:isOpen={isMachinesPageOpen} />
			{/snippet}
		</MotionTools>
	</ViamAppProvider>
</ViamProvider>
