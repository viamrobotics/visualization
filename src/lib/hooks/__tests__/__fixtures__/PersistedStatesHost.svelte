<script lang="ts">
	import { untrack } from 'svelte'

	import {
		providePersistedStates,
		usePersistedStates,
	} from '#lib/hooks/usePersistedStates.svelte.js'

	interface Props {
		storageKey: string | undefined
	}

	let { storageKey }: Props = $props()

	providePersistedStates(untrack(() => storageKey))

	const writer = usePersistedStates()('orientation-format', 'euler')
	const reader = usePersistedStates()('orientation-format', 'euler')
</script>

<button onclick={() => (writer.current = 'ov')}>Pick</button>
<output data-testid="reader">{reader.current}</output>
