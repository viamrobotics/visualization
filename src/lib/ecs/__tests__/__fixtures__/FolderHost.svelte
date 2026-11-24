<script lang="ts">
	import type { Trait } from 'koota'

	import { untrack } from 'svelte'

	import { useFolder } from '../../useFolder.svelte'

	interface Props {
		sources: Trait[]
		placeholder?: string
	}

	let { sources, placeholder }: Props = $props()

	// A producer declares its sources once, at mount, so only the first value is meant here.
	const initialSources = untrack(() => sources)

	useFolder({ id: 'drawn', name: 'Drawn', order: 700, sources: initialSources }, () => placeholder)
</script>
