<!--
@component

Keeps the Rapier collider set in step with the scene and reports what overlaps.

Renders nothing. It lives under `<World>` from `@threlte/rapier` purely to reach
`useRapier()`. Its findings land in two places: one entity per pair, which the
world tree lists, and the module-scope `collisionReports` store, which the move
panels read from a different branch of the tree.

Detection is coalesced into a microtask, the same shape the instanced renderers
and `useMoveGhosts` use: `WorldMatrix` fires once per entity per kinematics
tick, and one detection pass per tick is the useful cadence.
-->
<script lang="ts">
	import type { Entity } from 'koota'

	import { useRapier } from '@threlte/rapier'
	import { useResourceStatuses } from '@viamrobotics/svelte-sdk'

	import { traits, useWorld } from '$lib/ecs'
	import { usePartID } from '$lib/hooks/usePartID.svelte'
	import { useSettings } from '$lib/hooks/useSettings.svelte'

	import { clearCollisionColors, createColorStash, syncCollisionColors } from './collisionColors'
	import { createCollisionEntities } from './collisionEntities'
	import { collectMembers } from './collisionMembers'
	import { toReports } from './collisionReport'
	import { collisionReports } from './collisionStore.svelte'
	import { createCollisionWorld } from './collisionWorld'
	import { assignArmBits } from './interactionGroups'

	const M_PER_MM = 0.001

	const world = useWorld()
	const settings = useSettings()
	const partID = usePartID()
	const arms = useResourceStatuses(() => partID.current, 'arm')

	/** Undefined without an ancestor `<World>`, in which case there is nothing to do. */
	const physics = useRapier()

	const armBits = $derived(
		assignArmBits(
			arms.current.map((arm) => arm.name?.name).filter((name): name is string => name !== undefined)
		)
	)

	// The settings field is bound to a text input, so it can arrive as a string, or as one that is no number at all.
	const toleranceM = $derived.by(() => {
		const toleranceMM = Number(settings.current.collisionToleranceMM)
		return Number.isFinite(toleranceMM) && toleranceMM > 0 ? toleranceMM * M_PER_MM : 0
	})

	$effect(() => {
		if (!physics) return

		// Re-groups from scratch when the machine's arms change: a new arm needs its
		// own bit, and every collider under it has to be rebuilt to carry it. A new
		// tolerance rebuilds too, which is rare enough not to warrant a lighter path.
		const bits = armBits
		const tolerance = toleranceM

		const collisionWorld = createCollisionWorld(physics.rapier, physics.world)
		const stash = createColorStash()
		const pairEntities = createCollisionEntities(world)

		const run = () => {
			collisionWorld.sync(collectMembers(world, bits))

			const pairs = collisionWorld.detect(tolerance)
			const colliding = new Set<Entity>()
			for (const { a, b } of pairs) {
				colliding.add(a)
				colliding.add(b)
			}

			syncCollisionColors(colliding, stash)

			const reports = toReports(pairs)
			collisionReports.set(reports)
			pairEntities.sync(reports)
		}

		let scheduled = false
		const schedule = () => {
			if (scheduled) return
			scheduled = true
			queueMicrotask(() => {
				scheduled = false
				run()
			})
		}

		schedule()

		// `WorldMatrix` covers every source of movement: kinematics, staged edits, and ghosts
		// riding a drag. Its add and remove cover geometry streaming in and out. Colour writes
		// don't touch it, so this can't feed itself.
		const unsubscribes = [
			world.onAdd(traits.WorldMatrix, schedule),
			world.onChange(traits.WorldMatrix, schedule),
			world.onRemove(traits.WorldMatrix, schedule),
		]

		return () => {
			for (const unsubscribe of unsubscribes) unsubscribe()
			clearCollisionColors(stash)
			pairEntities.clear()
			collisionWorld.dispose()
			collisionReports.clear()
		}
	})
</script>
