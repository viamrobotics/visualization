import type { Entity, Trait, World } from 'koota'

import type { RefreshRateId } from '#lib/hooks/useSettings.svelte.js'

import { Folder } from './traits'
import { useWorld } from './useWorld'

/** What a producer declares about its folder. See `traits.Folder` for each field. */
export interface FolderSpec {
	id: string
	name: string
	order: number
	sources: Trait[]
	collapsed?: boolean
	sceneless?: boolean
	refreshRate?: RefreshRateId
}

interface SharedFolder {
	entity: Entity
	/** One source list per mounted producer, unioned into the trait. */
	contributions: Set<Trait[]>
}

const foldersByWorld = new WeakMap<World, Map<string, SharedFolder>>()

const unionOf = (contributions: Set<Trait[]>): Trait[] => [...new Set([...contributions].flat())]

/**
 * Keeps a world tree folder alive while the calling component is mounted. Producers
 * that name the same `id` share one entity: their sources are unioned, and the entity
 * is destroyed when the last of them unmounts. `placeholder` is reread reactively, and
 * an empty folder shows only while it returns a string.
 *
 * @returns The folder entity, for writing `Issues` about the folder as a whole.
 */
export const useFolder = (
	spec: FolderSpec,
	placeholder: () => string | undefined = () => undefined
): Entity => {
	const world = useWorld()

	let folders = foldersByWorld.get(world)
	if (!folders) {
		folders = new Map()
		foldersByWorld.set(world, folders)
	}

	const contribution = spec.sources
	let shared = folders.get(spec.id)

	if (shared?.entity.isAlive()) {
		shared.contributions.add(contribution)
		shared.entity.set(Folder, {
			...shared.entity.get(Folder)!,
			sources: unionOf(shared.contributions),
		})
	} else {
		shared = {
			entity: world.spawn(
				Folder({
					id: spec.id,
					name: spec.name,
					order: spec.order,
					sources: spec.sources,
					placeholder: undefined,
					collapsed: spec.collapsed ?? false,
					sceneless: spec.sceneless ?? false,
					refreshRate: spec.refreshRate,
				})
			),
			contributions: new Set([contribution]),
		}
		folders.set(spec.id, shared)
	}

	const { entity, contributions } = shared
	const registry = folders

	$effect(() => {
		const next = placeholder()
		const current = entity.get(Folder)
		if (current && current.placeholder !== next)
			entity.set(Folder, { ...current, placeholder: next })
	})

	$effect(() => {
		return () => {
			contributions.delete(contribution)

			if (contributions.size > 0) {
				const current = entity.get(Folder)
				if (current) entity.set(Folder, { ...current, sources: unionOf(contributions) })
				return
			}

			registry.delete(spec.id)
			if (entity.isAlive()) entity.destroy()
		}
	})

	return entity
}
