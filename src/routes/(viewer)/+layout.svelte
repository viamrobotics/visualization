<script lang="ts">
	import type { DialConf } from '@viamrobotics/sdk'

	import { ViamAppProvider, ViamProvider } from '@viamrobotics/svelte-sdk'

	import { Visualizer } from '$lib'
	import { backendIP } from '$lib/defines'
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

	import WorkspaceLink from '../lib/components/kinematics/WorkspaceLink.svelte'
	import MachineConnectionProvider from '../lib/components/MachineConnectionProvider.svelte'
	import Machines from '../lib/components/Machines.svelte'
	import { createIKSolutionsResolver } from '../lib/createIKSolutionsResolver'
	import {
		provideConnectionConfigs,
		useActiveConnectionConfig,
	} from '../lib/hooks/useConnectionConfigs.svelte'
	import { resolveConnection } from '../lib/resolveConnection'
	import { useLaunchConfig } from '../lib/tauri/useLaunchConfig.svelte'
	import { useDrawServerUrl } from '../lib/useDrawServerUrl.svelte'

	provideConnectionConfigs()

	const connectionConfig = useActiveConnectionConfig()
	const launch = useLaunchConfig()
	const drawServer = useDrawServerUrl()

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

	let isMachinesPageOpen = $state(false)
	let pluginsEnabled = true

	const resolveIKSolutions = createIKSolutionsResolver(() => drawServer.baseUrl)
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
					{#if drawServer.ready}
						<DrawService config={{ backendIP, port: drawServer.port }} />
					{/if}
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
					<Machines
						bind:isOpen={isMachinesPageOpen}
						{launch}
					/>
					<WorkspaceLink
						route="/kinematics"
						label="Kinematics"
						icon="robot-industrial-outline"
					/>
					<WorldTree />
					<Settings />
					<FileDrop />
					<FramePov />
				{/if}
			</Visualizer>
		</MachineConnectionProvider>
	</ViamAppProvider>
</ViamProvider>
