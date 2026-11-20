import { type Entity, trait } from 'koota'

import type { Relationship } from '#lib/metadata.js'

import { uuidBytesToString } from '#lib/draw.js'
import { relations, traits, useWorld } from '#lib/ecs/index.js'

interface Link {
	targetUuid: string
	type: string
	indexMapping: string
}

/**
 * Forward-references waiting on their target entity to arrive. Lives on the
 * source entity so it dies with it — no plugin-side bookkeeping to leak when
 * a source is destroyed before its targets show up.
 */
const PendingLinks = trait(() => [] as Link[])

/**
 * Diffs incoming server relationships against the last-known set per entity,
 * so only links the draw service itself authored are added or removed.
 * Client-added links (e.g. interactive HoverLinks from the Details overlay)
 * are left alone.
 */
export const createServerRelationships = () => {
	const world = useWorld()

	const cache = new Map<string, Map<string, Link>>()

	const lookupByUuid = (uuid: string) =>
		world.query(traits.UUID).find((entity) => entity.get(traits.UUID) === uuid)

	const enqueue = (sourceEntity: Entity, entry: Link) => {
		const existing = sourceEntity.get(PendingLinks) ?? []
		sourceEntity.set(PendingLinks, [...existing, entry])
	}

	const unsubAdd = world.onAdd(traits.UUID, (target) => {
		if (!target.isAlive()) return

		const targetUuid = target.get(traits.UUID)
		if (!targetUuid) return

		for (const source of world.query(PendingLinks)) {
			if (!source.isAlive()) continue

			const queue = source.get(PendingLinks) ?? []
			const remaining: Link[] = []
			let drained = false

			for (const entry of queue) {
				if (entry.targetUuid === targetUuid) {
					source.add(
						relations.SubEntityLink(target, { type: entry.type, indexMapping: entry.indexMapping })
					)
					drained = true
				} else {
					remaining.push(entry)
				}
			}

			if (!drained) continue
			if (remaining.length === 0) source.remove(PendingLinks)
			else source.set(PendingLinks, remaining)
		}
	})

	return {
		apply(sourceEntity: Entity, sourceUuid: string, relationships: Relationship[] | undefined) {
			const desired = new Map<string, Link>()

			for (const relationship of relationships ?? []) {
				const targetUuid = uuidBytesToString(relationship.targetUuid)
				if (!targetUuid) continue
				desired.set(targetUuid, {
					targetUuid,
					type: relationship.type,
					indexMapping: relationship.indexMapping ?? 'index',
				})
			}

			const previous = cache.get(sourceUuid) ?? new Map<string, Link>()

			for (const targetUuid of previous.keys()) {
				if (desired.has(targetUuid)) continue
				const target = lookupByUuid(targetUuid)
				if (target?.isAlive()) {
					sourceEntity.remove(relations.SubEntityLink(target))
				}
			}

			for (const [targetUuid, link] of desired) {
				const before = previous.get(targetUuid)
				if (before?.type === link.type && before?.indexMapping === link.indexMapping) {
					continue
				}

				const target = lookupByUuid(targetUuid)
				if (!target) {
					enqueue(sourceEntity, link)
					continue
				}
				sourceEntity.add(
					relations.SubEntityLink(target, { type: link.type, indexMapping: link.indexMapping })
				)
			}

			if (desired.size === 0) {
				cache.delete(sourceUuid)
			} else {
				cache.set(sourceUuid, desired)
			}
		},

		forget(sourceUuid: string) {
			cache.delete(sourceUuid)
		},

		reset() {
			cache.clear()
		},

		dispose() {
			unsubAdd()
			cache.clear()
		},
	}
}
