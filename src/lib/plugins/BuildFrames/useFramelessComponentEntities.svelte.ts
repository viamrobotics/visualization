import type { Entity, World } from 'koota'

import { onDestroy } from 'svelte'

import { selectOnly, traits, useWorld } from '$lib/ecs'
import { useEnvironment } from '$lib/hooks/useEnvironment.svelte'
import { useFramelessComponents } from '$lib/hooks/useFramelessComponents.svelte'
import { usePartConfig } from '$lib/hooks/usePartConfig.svelte'
import { usePartID } from '$lib/hooks/usePartID.svelte'

/**
 * Keeps one `FramelessComponent` entity per name in `names`, so the world tree
 * can list components the config gives no frame and their details panel can
 * offer to create one. Everything is destroyed while `active` is false.
 *
 * Entities are diffed against the list rather than respawned, so a row keeps
 * its identity — and with it the user's selection — while the rest churns.
 *
 * A selected row hands its selection to the frame that replaces it, so adding a
 * frame leaves the user on the same component with its real details open. The
 * replacement is spawned by the frame reconciler, which may land before or
 * after this, so it is resolved either way.
 *
 * @returns A teardown that destroys every entity it spawned.
 */
export const createFramelessComponentEntities = (
	world: World,
	active: () => boolean,
	names: () => string[]
): (() => void) => {
	const entities = new Map<string, Entity>()
	const awaitingFrame = new Set<string>()

	const selectReplacement = (row: Entity, name: string) => {
		const replacement = world
			.query(traits.Name)
			.find((entity) => entity !== row && entity.get(traits.Name) === name)

		if (replacement) selectOnly(world, replacement)
		else awaitingFrame.add(name)
	}

	const unsubscribe = world.onAdd(traits.Name, (entity) => {
		const name = entity.get(traits.Name)
		if (name === undefined || !awaitingFrame.delete(name)) return

		selectOnly(world, entity)
	})

	const destroyAll = () => {
		for (const entity of entities.values()) {
			if (entity.isAlive()) entity.destroy()
		}

		entities.clear()
		awaitingFrame.clear()
	}

	$effect(() => {
		if (!active()) {
			destroyAll()
			return
		}

		const wanted = new Set(names())

		// A name back on the list never got its frame, so stop waiting for one.
		for (const name of wanted) awaitingFrame.delete(name)

		for (const [name, entity] of entities) {
			if (wanted.has(name) && entity.isAlive()) continue

			if (entity.isAlive()) {
				if (entity.has(traits.Selected)) selectReplacement(entity, name)
				entity.destroy()
			}

			entities.delete(name)
		}

		for (const name of wanted) {
			if (entities.has(name)) continue

			entities.set(name, world.spawn(traits.Name(name), traits.FramelessComponent))
		}
	})

	return () => {
		unsubscribe()
		destroyAll()
	}
}

/**
 * Mounts `createFramelessComponentEntities` for the current part, active only
 * while build mode is editing it: the rows exist to be acted on, and the action
 * is `partConfig.createFrame`.
 */
export const useFramelessComponentEntities = (): void => {
	const world = useWorld()
	const environment = useEnvironment()
	const framelessComponents = useFramelessComponents()
	const partConfig = usePartConfig()
	const partID = usePartID()

	const active = $derived(
		environment.current.mode === 'build' && partID.current !== '' && partConfig.hasEditPermissions
	)

	onDestroy(
		createFramelessComponentEntities(
			world,
			() => active,
			() => framelessComponents.current
		)
	)
}
