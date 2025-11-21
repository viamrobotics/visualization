<script lang="ts">
	import { Canvas } from '@threlte/core'
	import { ToastContainer } from '@viamrobotics/prime-core'
	import type { PassSnapshot } from '$lib/snapshot'
	import SnapshotProviders from './SnapshotProviders.svelte'
	import SnapshotScene from './SnapshotScene.svelte'
	import { provideSettings } from '$lib/hooks/useSettings.svelte'
	import { provideEnvironment } from '$lib/hooks/useEnvironment.svelte'

	interface Props {
		snapshot: PassSnapshot
	}

	let { snapshot }: Props = $props()

	const settings = provideSettings()
	const environment = provideEnvironment()

	environment.current.isStandalone = true
	settings.current.enableKeybindings = false
</script>

<div class="relative h-full w-full overflow-hidden">
	<Canvas renderMode="on-demand">
		<SnapshotProviders {snapshot}>
			{#snippet children({ cameraPose })}
				<SnapshotScene
					{snapshot}
					{cameraPose}
				/>
			{/snippet}
		</SnapshotProviders>
	</Canvas>

	<ToastContainer />
</div>
