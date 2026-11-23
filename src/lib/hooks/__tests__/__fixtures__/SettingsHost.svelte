<script lang="ts">
	import { untrack } from 'svelte'

	import { provideSettings, useSettings } from '#lib/hooks/useSettings.svelte.js'

	interface Props {
		persist: boolean
	}

	let { persist }: Props = $props()

	provideSettings({ persist: untrack(() => persist) })

	const settings = useSettings()
</script>

<button
	onclick={() => (settings.current.enableDollyToCursor = !settings.current.enableDollyToCursor)}
>
	Toggle
</button>
<output data-testid="loaded">{settings.isLoaded}</output>
