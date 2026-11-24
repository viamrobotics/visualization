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

/** What a producer says about its folder while mounted. Each is reread reactively. */
export interface FolderState {
	/** Shown in place of rows while the folder is empty. */
	placeholder?: () => string | undefined
	/** Keeps the folder in the tree while empty, with no placeholder text. */
	pinned?: () => boolean
}

/** One mounted producer's share of a folder. */
interface Contribution {
	sources: Trait[]
	placeholder: string | undefined
	pinned: boolean
}

interface SharedFolder {
	entity: Entity
	contributions: Set<Contribution>
}

const foldersByWorld = new WeakMap<World, Map<string, SharedFolder>>()

/**
 * Writes what every mounted producer says into the folder trait: their sources
 * unioned, the first placeholder any of them sets, and pinned if any of them pins.
 * Writes nothing when that is what the trait holds already.
 */
const syncFolder = ({ entity, contributions }: SharedFolder): void => {
	const current = entity.get(Folder)
	if (!current) return

	const all = [...contributions]
	const sources = [...new Set(all.flatMap((contribution) => contribution.sources))]
	const placeholder = all.find(
		(contribution) => contribution.placeholder !== undefined
	)?.placeholder
	const pinned = all.some((contribution) => contribution.pinned)

	const isSameSources =
		sources.length === current.sources.length &&
		sources.every((source, index) => source === current.sources[index])

	if (isSameSources && placeholder === current.placeholder && pinned === current.pinned) return

	entity.set(Folder, { ...current, sources, placeholder, pinned })
}

/**
 * Keeps a world tree folder alive while the calling component is mounted. Producers
 * that name the same `id` share one entity, and each keeps its own sources, placeholder
 * and pin, so one producer never overwrites another's. The entity is destroyed when the
 * last of them unmounts.
 *
 * @returns The folder entity, for writing `Issues` about the folder as a whole.
 */
export const useFolder = (spec: FolderSpec, state: FolderState = {}): Entity => {
	const world = useWorld()

	let folders = foldersByWorld.get(world)
	if (!folders) {
		folders = new Map()
		foldersByWorld.set(world, folders)
	}

	const contribution: Contribution = {
		sources: spec.sources,
		placeholder: undefined,
		pinned: false,
	}
	let shared = folders.get(spec.id)

	if (!shared?.entity.isAlive()) {
		shared = {
			entity: world.spawn(
				Folder({
					id: spec.id,
					name: spec.name,
					order: spec.order,
					sources: [],
					placeholder: undefined,
					pinned: false,
					collapsed: spec.collapsed ?? false,
					sceneless: spec.sceneless ?? false,
					refreshRate: spec.refreshRate,
				})
			),
			contributions: new Set(),
		}
		folders.set(spec.id, shared)
	}

	shared.contributions.add(contribution)
	syncFolder(shared)

	const folder = shared
	const registry = folders

	$effect(() => {
		contribution.placeholder = state.placeholder?.()
		contribution.pinned = state.pinned?.() ?? false
		syncFolder(folder)
	})

	$effect(() => {
		return () => {
			folder.contributions.delete(contribution)

			if (folder.contributions.size > 0) {
				syncFolder(folder)
				return
			}

			registry.delete(spec.id)
			if (folder.entity.isAlive()) folder.entity.destroy()
		}
	})

	return folder.entity
}
