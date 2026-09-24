<script lang="ts">
	import '@viamrobotics/tailwind-config/fonts'

	import '../app.css'

	import type { DialConf } from '@viamrobotics/sdk'

	import { ViamAppProvider, ViamProvider } from '@viamrobotics/svelte-sdk'

	import { page } from '$app/state'
	import { Visualizer } from '$lib'
	import { backendIP, drawServicePort } from '$lib/defines'
	import {
		BuildFrames,
		ControlWidgets,
		DrawService,
		FileDrop,
		FramePov,
		Isolate,
		Logs,
		MeasureTool,
		Monitor,
		MotionPlanReplayer,
		MoveFrame,
		Settings,
		WorldTree,
		XR,
	} from '$lib/plugins'

	import MachineConnectionProvider from './lib/components/MachineConnectionProvider.svelte'
	import Machines from './lib/components/Machines.svelte'
	import {
		provideConnectionConfigs,
		useActiveConnectionConfig,
	} from './lib/hooks/useConnectionConfigs.svelte'
	import { readDrawServicePortOverride } from './lib/readDrawServicePortOverride'
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
	const dialConfig = $derived(partID ? dialConfigs[partID] : undefined)

	let isMachinesPageOpen = $state(false)

	let pluginsEnabled = true

	const portOverride = $derived(readDrawServicePortOverride(page.url.search))
</script>

<ViamProvider
	options={{ resetQueriesOnDisconnect: false }}
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
		<MachineConnectionProvider
			{partID}
			{dialConfig}
		>
			<Visualizer
				{partID}
				inputBindingsEnabled={!isMachinesPageOpen}
			>
				{@render children()}

				{#if pluginsEnabled}
					<DrawService config={{ backendIP, port: portOverride ?? drawServicePort }} />
					<Isolate />
					<MeasureTool />

					<Monitor />
					<BuildFrames />
					<MoveFrame />
					<MotionPlanReplayer />

					<XR />

					<Logs />
					<ControlWidgets />
					<Machines bind:isOpen={isMachinesPageOpen} />
					<WorldTree />
					<Settings />
					<FileDrop />
					<FramePov />
				{/if}
			</Visualizer>
		</MachineConnectionProvider>
	</ViamAppProvider>
</ViamProvider>
