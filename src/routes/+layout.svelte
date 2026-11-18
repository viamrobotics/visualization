<script lang="ts">
	import '@viamrobotics/tailwind-config/fonts'

	import '../app.css'

	import type { DialConf } from '@viamrobotics/sdk'

	import { ViamAppProvider, ViamProvider } from '@viamrobotics/svelte-sdk'
	import { untrack } from 'svelte'

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
	import { useDrawServicePort } from './lib/desktop/useDrawServicePort.svelte'
	import { useLaunchConfig } from './lib/desktop/useLaunchConfig.svelte'
	import { dialIdentity } from './lib/dialIdentity'
	import {
		provideConnectionConfigs,
		useActiveConnectionConfig,
	} from './lib/hooks/useConnectionConfigs.svelte'
	import { readDrawServicePortOverride } from './lib/readDrawServicePortOverride'
	import { type AccountConnection, resolveConnection } from './lib/resolveConnection'
	import { provideAccountMachines } from './lib/viamLogin/useAccountMachines.svelte'
	import { provideAccountPart } from './lib/viamLogin/useAccountPart.svelte'
	import { provideViamSession } from './lib/viamLogin/useViamSession.svelte'

	provideConnectionConfigs()

	const connectionConfig = useActiveConnectionConfig()
	const launch = useLaunchConfig()
	const sidecar = useDrawServicePort()

	let { children } = $props()

	let pluginsEnabled = true

	const portOverride = $derived(readDrawServicePortOverride(page.url.search))

	const drawPort = $derived(portOverride ?? sidecar.port ?? drawServicePort)
	const drawServerUrl = $derived(`http://${backendIP}:${drawPort}`)

	const accountPart = provideAccountPart()
	const viamSession = provideViamSession(
		() => (sidecar.ready ? drawServerUrl : undefined),
		() => accountPart.set(null)
	)
	provideAccountMachines(() =>
		viamSession.state.status === 'active' ? viamSession.state.session.accessToken : undefined
	)

	const accountConnection = $derived.by<AccountConnection | undefined>(() => {
		const part = accountPart.current
		if (!part || viamSession.state.status !== 'active') return undefined
		return { part, accessToken: viamSession.state.session.accessToken }
	})

	const resolved = $derived(
		launch.ready
			? resolveConnection(
					launch.current,
					accountConnection,
					$state.snapshot(connectionConfig.current)
				)
			: undefined
	)

	const partID = $derived(resolved?.partId)
	// Always current, so a retry after a dropped connection dials with the latest token.
	const dialConfig = $derived(resolved?.dialConf)

	const liveDialIdentity = $derived(resolved && dialIdentity(resolved.partId, resolved.dialConf))
	// ViamProvider redials on any config change. Tracking only the identity keeps a token refresh
	// from dropping a live connection.
	const dialConfigs = $derived.by<Record<string, DialConf>>(() => {
		if (!liveDialIdentity) return {}
		return untrack(() => (resolved ? { [resolved.partId]: resolved.dialConf } : {}))
	})

	const resolveIKSolutions = createIKSolutionsResolver(() => drawServerUrl)
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
					{#if sidecar.ready}
						<DrawService config={{ backendIP, port: drawPort }} />
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
