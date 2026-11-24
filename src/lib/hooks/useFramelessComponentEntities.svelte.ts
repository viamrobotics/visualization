import type { Entity, World } from 'koota'

import { onDestroy } from 'svelte'

import { type FolderSpec, selectOnly, traits, useFolder, useWorld } from '#lib/ecs/index.js'

import { useFramelessComponents } from './useFramelessComponents.svelte'

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

const FRAMELESS_COMPONENTS_FOLDER = {
	id: 'frameless-components',
	name: 'Frameless components',
	order: 600,
	sources: [traits.FramelessComponent],
	collapsed: true,
	sceneless: true,
} satisfies FolderSpec

/**
 * Mounts `createFramelessComponentEntities` for the current part, in every mode, so a
 * component without a frame still has a row to carry its health and its logs.
 */
export const useFramelessComponentEntities = (partID: () => string): void => {
	const world = useWorld()
	const framelessComponents = useFramelessComponents()

	useFolder(FRAMELESS_COMPONENTS_FOLDER)

	onDestroy(
		createFramelessComponentEntities(
			world,
			() => partID() !== '',
			() => framelessComponents.current
		)
	)
}
