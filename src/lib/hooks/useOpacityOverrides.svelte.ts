import { type Entity, type World } from 'koota'

import { setOrAddTrait } from '$lib/ecs/setOrAddTrait'
import { Name, OpacityOverride, UUID } from '$lib/ecs/traits'
import { useWorld } from '$lib/ecs/useWorld'

/**
 * Every key the entity can be recognised by after a respawn. `useFrames` and
 * `usePointcloudObjects` reconcile against a name, the draw and world-state
 * paths against a transform uuid, and a spawn adds the two traits in whatever
 * order its caller listed them. Recording under both and matching on either is
 * what makes the lookup independent of that order.
 */
const keysOf = (entity: Entity): string[] => {
	const keys: string[] = []
	const uuid = entity.get(UUID)
	if (uuid) keys.push(uuid)
	const name = entity.get(Name)
	if (name) keys.push(name)
	return keys
}

/** @returns An unsubscribe that also forgets every recorded override. */
export const addOpacityOverrideListeners = (world: World) => {
	const opacityByKey = new Map<string, number>()

	const record = (entity: Entity) => {
		const opacity = entity.get(OpacityOverride)
		if (opacity === undefined) return
		for (const key of keysOf(entity)) opacityByKey.set(key, opacity)
	}

	const restore = (entity: Entity) => {
		for (const key of keysOf(entity)) {
			const opacity = opacityByKey.get(key)
			if (opacity !== undefined) {
				setOrAddTrait(entity, OpacityOverride, opacity)
				return
			}
		}
	}

	const unsubs = [
		world.onAdd(OpacityOverride, record),
		world.onChange(OpacityOverride, record),
		world.onAdd(Name, restore),
		world.onAdd(UUID, restore),
	]

	return () => {
		for (const unsub of unsubs) unsub()
		opacityByKey.clear()
	}
}

/**
 * Carries a user's opacity edit across a respawn.
 *
 * A reconciler that destroys and re-creates an entity instead of updating it
 * hands back a fresh trait set, so an `OpacityOverride` written against the old
 * entity id is gone. Keying the value to the name or uuid the reconciler spawns
 * under puts it back.
 */
export const provideOpacityOverrides = (): void => {
	const world = useWorld()

	$effect(() => addOpacityOverrideListeners(world))
}
