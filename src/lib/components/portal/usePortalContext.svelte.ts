import type { Snippet } from 'svelte'
import { SvelteMap, SvelteSet } from 'svelte/reactivity'

type PortalContext = SvelteMap<string, SvelteSet<Snippet>>

export const DEFAULT_ID = 'default'

const context = new SvelteMap<string, SvelteSet<Snippet>>()

export const usePortalContext = (): PortalContext => {
	return context
}
