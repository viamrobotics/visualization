<script lang="ts">
	import type { Snippet } from 'svelte'
	import { usePortalContext } from './usePortalContext.svelte'
	import { SvelteSet } from 'svelte/reactivity'
	import type { Entity } from 'koota'
	import { traits, useTrait } from '$lib/ecs'

	interface Props {
		id?: string
		entity?: Entity
		children?: Snippet
	}

	let { id, entity, children }: Props = $props()

	const portals = usePortalContext()

	const editedParent = useTrait(() => entity, traits.EditedParent)
	const parent = useTrait(() => entity, traits.Parent)
	const resolvedId = $derived(id ?? editedParent.current ?? parent.current ?? 'world')

	$effect.pre(() => {
		if (!children) return

		if (!portals.has(resolvedId)) {
			portals.set(resolvedId, new SvelteSet())
		}

		portals.get(resolvedId)?.add(children)
		return () => portals.get(resolvedId)?.delete(children)
	})
</script>
