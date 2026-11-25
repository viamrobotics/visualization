<script lang="ts">
	import '@viamrobotics/tailwind-config/fonts'

	import '../app.css'

	import { Visualizer } from '#lib'

	import { STANDALONE_STORAGE_KEY } from './lib/standaloneStorageKey'

	let { children } = $props()
</script>

<Visualizer storageKey={STANDALONE_STORAGE_KEY}>
	{@render children()}
</Visualizer>
