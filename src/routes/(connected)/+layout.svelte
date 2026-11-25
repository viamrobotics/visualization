<script lang="ts">
	import type { DialConf } from '@viamrobotics/sdk'

	import { ViamAppProvider, ViamProvider } from '@viamrobotics/svelte-sdk'
	import { untrack } from 'svelte'

	import { page } from '$app/state'

	import MachineConnectionProvider from '../lib/components/MachineConnectionProvider.svelte'
	import Machines from '../lib/components/Machines.svelte'
	import { useLaunchConfig } from '../lib/desktop/useLaunchConfig.svelte'
	import { dialIdentity } from '../lib/dialIdentity'
	import {
		provideConnectionConfigs,
		useActiveConnectionConfig,
	} from '../lib/hooks/useConnectionConfigs.svelte'
	import { provideDrawServer } from '../lib/hooks/useDrawServer.svelte'
	import { type AccountConnection, resolveConnection } from '../lib/resolveConnection'
	import { provideAccountMachines } from '../lib/viamLogin/useAccountMachines.svelte'
	import { provideAccountPart } from '../lib/viamLogin/useAccountPart.svelte'
	import { provideFavoriteMachines } from '../lib/viamLogin/useFavoriteMachines.svelte'
	import { provideViamSession } from '../lib/viamLogin/useViamSession.svelte'

	provideConnectionConfigs()

	const connectionConfig = useActiveConnectionConfig()
	const launch = useLaunchConfig()
	const drawServer = provideDrawServer(() => page.url.search)

	let { children } = $props()

	const accountPart = provideAccountPart()
	const viamSession = provideViamSession(
		() => (drawServer.ready ? drawServer.url : undefined),
		() => accountPart.set(null)
	)
	const getAccountAccessToken = () =>
		viamSession.state.status === 'active' ? viamSession.state.session.accessToken : undefined
	provideAccountMachines(getAccountAccessToken)
	provideFavoriteMachines(getAccountAccessToken)

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
			{@render children()}

			<Machines {launch} />
		</MachineConnectionProvider>
	</ViamAppProvider>
</ViamProvider>
