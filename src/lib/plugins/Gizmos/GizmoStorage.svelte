<!--
@component

Renders nothing. Mounted for its side effects only: while the storage toggle is
on, placed gizmos are written to storage as they change and restored on mount.
While it is off, nothing is written and any previously stored payload for the
current part is cleared, so a reload never resurrects gizmos the user dismissed.
-->
<script lang="ts">
	import { untrack } from 'svelte'

	import { traits, useWorld } from '$lib/ecs'

	import { deserializeGizmos } from './deserializeGizmos'
	import { type GizmoStore, gizmoStoreKey } from './gizmoRecord'
	import { serializeGizmos } from './serializeGizmos'
	import { AngleMeasure, PolylineMeasure, ReferencePlane } from './traits'
	import { useGizmoStorage } from './useGizmoStorage.svelte'

	/**
	 * Coalescing window for writes. Dragging a gizmo with the transform handles fires a
	 * stream of matrix changes per frame, and writing to storage on each one is wasteful.
	 */
	const SAVE_DEBOUNCE_MS = 400

	const world = useWorld()
	const storage = useGizmoStorage()

	const readGizmoStore = (partID: string): unknown => {
		try {
			const raw = localStorage.getItem(gizmoStoreKey(partID))
			return raw === null ? undefined : JSON.parse(raw)
		} catch {
			return undefined
		}
	}

	// localStorage can throw (private browsing, quota, blocked site data). A failed
	// write or clear must not take down the render.
	const writeGizmoStore = (partID: string, store: GizmoStore) => {
		try {
			localStorage.setItem(gizmoStoreKey(partID), JSON.stringify(store))
		} catch {
			// see comment above
		}
	}

	const clearGizmoStore = (partID: string) => {
		try {
			localStorage.removeItem(gizmoStoreKey(partID))
		} catch {
			// see writeGizmoStore
		}
	}

	// Restores once per part. Keying the effect on `partID` alone, and reading `enabled`
	// through `untrack`, means a later toggle flip does not replay this, only a genuine
	// part switch does — each part restores its own store instead of the previous one.
	$effect(() => {
		const partID = storage.partID
		if (!untrack(() => storage.enabled)) return
		deserializeGizmos(world, readGizmoStore(partID))
	})

	// Clears the stored payload whenever persistence is off, including the moment it is
	// switched off, so a later reload does not resurrect gizmos the user dismissed.
	$effect(() => {
		if (storage.enabled) return
		clearGizmoStore(storage.partID)
	})

	// Saves while enabled. Every trait a placed gizmo's pose, dimensions, or appearance
	// can carry is watched, alongside the entity set itself, and coalesced into one
	// debounced write per burst of changes.
	$effect(() => {
		if (!storage.enabled) return
		const partID = storage.partID

		let timeout: ReturnType<typeof setTimeout> | undefined
		const scheduleSave = () => {
			clearTimeout(timeout)
			timeout = setTimeout(() => {
				writeGizmoStore(partID, serializeGizmos(world))
			}, SAVE_DEBOUNCE_MS)
		}

		const watchedTraits = [
			traits.Matrix,
			traits.Color,
			traits.Opacity,
			traits.ShowAxesHelper,
			traits.Box,
			traits.Sphere,
			traits.Capsule,
			traits.LinePositions,
			traits.LineWidth,
			traits.DotSize,
			traits.DotColors,
			traits.Wireframe,
			traits.ScreenSpace,
			traits.Name,
			ReferencePlane,
			PolylineMeasure,
			AngleMeasure,
		]

		const unsubscribes = [
			world.onAdd(traits.Gizmo, scheduleSave),
			world.onRemove(traits.Gizmo, scheduleSave),
			...watchedTraits.map((trait) => world.onChange(trait, scheduleSave)),
		]

		return () => {
			clearTimeout(timeout)
			for (const unsubscribe of unsubscribes) unsubscribe()
		}
	})
</script>
