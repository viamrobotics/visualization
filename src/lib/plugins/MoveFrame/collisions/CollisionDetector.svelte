<!--
@component

Keeps the Rapier collider set in step with the scene and reports what overlaps.

Renders nothing. It lives under `<World>` from `@threlte/rapier` purely to reach
`useRapier()`, and writes its findings to the module-scope `collisionReports`
store — the move panels that display them sit in a different branch of the tree,
so context could not carry the result to both.

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

	import { clearCollisionColors, createColorStash, syncCollisionColors } from './collisionColors'
	import { collectMembers } from './collisionMembers'
	import { toReports } from './collisionReport'
	import { collisionReports } from './collisionStore.svelte'
	import { createCollisionWorld } from './collisionWorld'
	import { assignArmBits } from './interactionGroups'

	const world = useWorld()
	const partID = usePartID()
	const arms = useResourceStatuses(() => partID.current, 'arm')

	/** Undefined without an ancestor `<World>`, in which case there is nothing to do. */
	const physics = useRapier()

	const armBits = $derived(
		assignArmBits(
			arms.current.map((arm) => arm.name?.name).filter((name): name is string => name !== undefined)
		)
	)

	$effect(() => {
		if (!physics) return

		// Re-groups from scratch when the machine's arms change: a new arm needs its
		// own bit, and every collider under it has to be rebuilt to carry it.
		const bits = armBits

		const collisionWorld = createCollisionWorld(physics.rapier, physics.world)
		const stash = createColorStash()

		const run = () => {
			collisionWorld.sync(collectMembers(world, bits))

			const pairs = collisionWorld.detect()
			const colliding = new Set<Entity>()
			for (const { a, b } of pairs) {
				colliding.add(a)
				colliding.add(b)
			}

			syncCollisionColors(colliding, stash)
			collisionReports.set(toReports(pairs))
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
			collisionWorld.dispose()
			collisionReports.clear()
		}
	})
</script>
