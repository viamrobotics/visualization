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
		SensorCoverage,
		Settings,
		WorldTree,
		XR,
	} from '$lib/plugins'

	import MachineConnectionProvider from './lib/components/MachineConnectionProvider.svelte'
	import Machines from './lib/components/Machines.svelte'
	import { createIKSolutionsResolver } from './lib/createIKSolutionsResolver'
	import {
		provideConnectionConfigs,
		useActiveConnectionConfig,
	} from './lib/hooks/useConnectionConfigs.svelte'
	import { readDrawServicePortOverride } from './lib/readDrawServicePortOverride'
	import { resolveConnection } from './lib/resolveConnection'
	import { useLaunchConfig } from './lib/tauri/useLaunchConfig.svelte'

	provideConnectionConfigs()

	const connectionConfig = useActiveConnectionConfig()
	const launch = useLaunchConfig()

	let { children } = $props()

	const resolved = $derived(
		launch.ready
			? resolveConnection(launch.current, $state.snapshot(connectionConfig.current))
			: undefined
	)

	const dialConfigs = $derived<Record<string, DialConf>>(
		resolved ? { [resolved.partId]: resolved.dialConf } : {}
	)
	const partID = $derived(resolved?.partId)
	const dialConfig = $derived(resolved?.dialConf)

	let pluginsEnabled = true

	const portOverride = $derived(readDrawServicePortOverride(page.url.search))

	const resolveIKSolutions = createIKSolutionsResolver(
		() => `http://${backendIP}:${portOverride ?? drawServicePort}`
	)
</script>

<ViamProvider
	options={{ resetQueriesOnDisconnect: false }}
	{dialConfigs}
>
	<ViamAppProvider
		serviceHost={launch.current?.serviceHost ?? 'https://app.viam.com'}
		credentials={resolved?.appCredentials ?? { type: 'api-key', payload: '', authEntity: '' }}
	>
		<MachineConnectionProvider
			{partID}
			{dialConfig}
		>
			<Visualizer {partID}>
				{@render children()}

				{#if pluginsEnabled}
					<DrawService config={{ backendIP, port: portOverride ?? drawServicePort }} />
					<Isolate />
					<MeasureTool />
					<SensorCoverage />

					<Monitor />
					<BuildFrames />
					<MoveFrame />
					<MotionPlanReplayer {resolveIKSolutions} />

					<XR />

					<Logs />
					<ControlWidgets />
					<Machines {launch} />
					<WorldTree />
					<Settings />
					<FileDrop />
					<FramePov />
				{/if}
			</Visualizer>
		</MachineConnectionProvider>
	</ViamAppProvider>
</ViamProvider>
