<script lang="ts">
	import '../app.css'

	import type { DialConf } from '@viamrobotics/sdk'
	import { ViamProvider } from '@viamrobotics/svelte-sdk'
	import { MotionTools } from '$lib'
	import {
		provideConnectionConfigs,
		useActiveConnectionConfig,
	} from './lib/hooks/useConnectionConfigs.svelte'
	import Machines from './lib/components/Machines.svelte'
	import { getDialConfs } from './lib/robots'
	import { PersistedState } from 'runed'
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

	const queryDevtoolsOpen = new PersistedState('query-devtools-open', false)

	const client = new QueryClient({
		defaultOptions: {
			queries: {
				staleTime: Infinity,
			},
		},
	})

	let isMachinesPageOpen = $state(false)
</script>

<svelte:window
	onkeydown={({ key }) => {
		if (key === '0') {
			queryDevtoolsOpen.current = !queryDevtoolsOpen.current
		}
	}}
/>

<Machines bind:isOpen={isMachinesPageOpen} />

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
