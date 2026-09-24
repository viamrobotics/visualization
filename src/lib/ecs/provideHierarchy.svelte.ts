import { resolveOrphans } from './hierarchy'
import { Name, Orphan } from './traits'
import { useQuery } from './useQuery.svelte'
import { useWorld } from './useWorld'

/**
 * Mounts the hierarchy resolver: each tick, any entity with `Orphan(name)`
 * whose desired parent is now in the world is converted to
 * `ChildOf(parentEntity)`. Call once at the top of the app, alongside the
 * other `provide*` hooks.
 *
 * Reactive on:
 *   - `useQuery(Orphan)` membership — new orphans appear or resolve away
 *   - `useQuery(Name)` membership — new candidate parents appear/disappear
 *   - `world.onChange(Name)` — an existing entity is renamed into a name
 *     that some orphan is waiting for
 *
 * Children whose `ChildOf` parent is destroyed are *not* automatically
 * re-orphaned. Call `hierarchy.setParent` on the affected children
 * explicitly if you need them to reattach to a same-named replacement.
 */
export const provideHierarchy = (): void => {
	const world = useWorld()
	const orphans = useQuery(Orphan)
	// A frameless component has no transform to compose through, so it must never
	// be picked as an orphan's parent.
	const named = useQuery(Name)

	$effect(() => {
		resolveOrphans(named.current, orphans.current)
	})

	$effect(() => {
		return world.onChange(Name, () => resolveOrphans(named.current, orphans.current))
	})
}
