<script lang="ts">
	import { ViamAppProvider, ViamProvider } from '@viamrobotics/svelte-sdk'

	import { Visualizer } from '$lib'

	let { children } = $props()
</script>

<!-- No machine connection and no machine plugins: tools in this group work on local data. -->
<ViamProvider
	options={{ resetQueriesOnDisconnect: false }}
	dialConfigs={{}}
>
	<ViamAppProvider
		serviceHost="https://app.viam.com"
		credentials={{ type: 'api-key', payload: '', authEntity: '' }}
	>
		<Visualizer>
			{@render children()}
		</Visualizer>
	</ViamAppProvider>
</ViamProvider>
