import { type Entity, Not, Or, type World } from 'koota'

import { PreviewGhost } from '#lib/components/motion/previewGhostTrait.js'
import { relations, traits, useWorld } from '#lib/ecs/index.js'
import { originFrameName } from '#lib/kinematicsFrames.js'

const GEOMETRY_TRAITS = [
	traits.Box,
	traits.Sphere,
	traits.Capsule,
	traits.Cylinder,
	traits.BufferGeometry,
] as const

// A preview ghost is the move being decided on, so it stays undimmed whichever frame is in focus.
const EXCLUDED_TRAITS = [traits.Points, traits.DrawAPI, traits.GhostModelKey, PreviewGhost] as const

/** Every trait whose arrival or departure can change which entities are candidates or in focus. */
const WATCHED_TRAITS = [...GEOMETRY_TRAITS, ...EXCLUDED_TRAITS, traits.Name] as const

const ORIGIN_SUFFIX = originFrameName('')

const entitiesNamed = (world: World, name: string): Entity[] =>
	world.query(traits.Name).filter((entity) => entity.get(traits.Name) === name)

/** The entities `name` addresses, falling back from `<x>_origin` to `<x>` when nothing carries the name itself. */
const resolveFocusRoots = (world: World, name: string): Entity[] => {
	const exact = entitiesNamed(world, name)
	if (exact.length > 0 || !name.endsWith(ORIGIN_SUFFIX)) return exact

	const componentName = name.slice(0, -ORIGIN_SUFFIX.length)
	return componentName ? entitiesNamed(world, componentName) : []
}

/** The focus roots, every `ChildOf` ancestor above them, and their whole `ChildOf` subtree. */
const collectFocused = (world: World, roots: readonly Entity[]): Set<Entity> => {
	const focused = new Set<Entity>()

	const addSubtree = (entity: Entity) => {
		if (focused.has(entity)) return
		focused.add(entity)
		for (const child of world.query(relations.ChildOf(entity))) {
			addSubtree(child)
		}
	}

	for (const root of roots) {
		let ancestor = root.targetFor(relations.ChildOf)
		// A `ChildOf` cycle is malformed, but the walk must still end.
		while (ancestor?.isAlive() && !focused.has(ancestor)) {
			focused.add(ancestor)
			ancestor = ancestor.targetFor(relations.ChildOf)
		}
		addSubtree(root)
	}

	return focused
}

/** Brings `Dimmed` in line with `name`: on every candidate outside the focus, on nothing else. */
const applyFocus = (world: World, name: string | undefined): void => {
	const entitiesToDim = new Set<Entity>()

	if (name) {
		const focused = collectFocused(world, resolveFocusRoots(world, name))
		for (const candidate of world.query(Or(...GEOMETRY_TRAITS), Not(...EXCLUDED_TRAITS))) {
			if (!focused.has(candidate)) entitiesToDim.add(candidate)
		}
	}

	for (const entity of world.query(traits.Dimmed)) {
		if (!entitiesToDim.has(entity)) entity.remove(traits.Dimmed)
	}
	for (const entity of entitiesToDim) {
		if (!entity.has(traits.Dimmed)) entity.add(traits.Dimmed)
	}
}

/**
 * Keeps one frame in focus. Every collidable geometry outside that frame's subtree and its
 * ancestors carries `Dimmed`, and nothing else does. Point clouds and draw API entities are never
 * dimmed. An empty or undefined name dims nothing. A name that matches no frame dims every
 * candidate. Re-runs as entities arrive, and removes every `Dimmed` it added on unmount.
 *
 * Call it in a component under `provideWorld`.
 *
 * @param frame A getter for the focused frame's name. A component's bare name keeps its whole
 *   kinematic chain in focus, and `<name>_origin` resolves to the same frame.
 */
export const useFrameFocus = (frame: () => string | undefined): void => {
	const world = useWorld()

	$effect(() => {
		const name = frame()
		applyFocus(world, name)

		let isTornDown = false
		let isScheduled = false

		// A frame load spawns many entities in one burst, so collapse its events into one pass.
		const schedule = () => {
			if (isScheduled) return
			isScheduled = true
			queueMicrotask(() => {
				isScheduled = false
				if (!isTornDown) applyFocus(world, name)
			})
		}

		const unsubscribers = [
			...WATCHED_TRAITS.flatMap((trait) => [
				world.onAdd(trait, schedule),
				world.onRemove(trait, schedule),
			]),
			world.onChange(traits.Name, schedule),
			world.onAdd(relations.ChildOf, schedule),
			world.onRemove(relations.ChildOf, schedule),
		]

		return () => {
			isTornDown = true
			for (const unsubscribe of unsubscribers) unsubscribe()
		}
	})

	// Separate from the effect above so a frame change re-diffs `Dimmed` instead of clearing and re-adding it.
	$effect(() => () => applyFocus(world, undefined))
}
