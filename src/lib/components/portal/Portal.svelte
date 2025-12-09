<script lang="ts">
	import type { Snippet } from 'svelte'
	import { DEFAULT_ID, usePortalContext } from './usePortalContext.svelte'
	import { SvelteSet } from 'svelte/reactivity'

	interface Props {
		id?: string
		children?: Snippet
	}

	let { id = DEFAULT_ID, children }: Props = $props()

	const portals = usePortalContext()

	$effect.pre(() => {
		if (!children) return

		if (!portals.has(id)) {
			portals.set(id, new SvelteSet())
		}

		portals.get(id)?.add(children)
		return () => portals.get(id)?.delete(children)
	})
</script>
