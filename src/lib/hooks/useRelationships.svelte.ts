import type { Entity } from 'koota'

import { getContext, setContext } from 'svelte'

import type { Relationship } from '$lib/metadata'

import { uuidBytesToString } from '$lib/draw'
import { relations, traits, useQuery } from '$lib/ecs'

const RELATIONSHIPS_CONTEXT_KEY = Symbol('relationships')

interface PendingRelationship {
	entity: Entity
	type: string
	indexMapping?: string
}

export const provideRelationships = () => {
	const uuids = useQuery(traits.UUID)
	const pending = new Map<string, Array<PendingRelationship>>()

	const addPending = (targetUuid: string, relationship: PendingRelationship) => {
		const next = pending.get(targetUuid) ?? []
		next.push(relationship)
		pending.set(targetUuid, next)
	}

	return setContext(RELATIONSHIPS_CONTEXT_KEY, {
		apply(entity: Entity, relationships: Relationship[] | undefined) {
			const desired = relationships ?? []
			const currentTargets = entity.targetsFor(relations.SubEntityLink)
			const desiredByUuid = new Map<string, Relationship>()
			for (const rel of desired) {
				const targetUUID = uuidBytesToString(rel.targetUuid)
				if (!targetUUID) continue
				desiredByUuid.set(targetUUID, rel)
			}

			for (const target of currentTargets) {
				if (!target.isAlive()) continue
				const targetUuid = target.get(traits.UUID)
				if (!targetUuid || !desiredByUuid.has(targetUuid)) {
					entity.remove(relations.SubEntityLink(target))
				}
			}

			for (const [uuid, relationship] of desiredByUuid) {
				const targetEntity = uuids.current.find((e) => e.get(traits.UUID) === uuid)
				if (!targetEntity) {
					addPending(uuid, {
						entity: entity,
						type: relationship.type,
						indexMapping: relationship.indexMapping,
					})
					continue
				}

				const existing = entity.get(relations.SubEntityLink(targetEntity))
				if (
					existing &&
					existing.type === relationship.type &&
					existing.indexMapping === (relationship.indexMapping ?? 'index')
				) {
					continue
				}

				entity.add(
					relations.SubEntityLink(targetEntity, {
						type: relationship.type,
						indexMapping: relationship.indexMapping ?? 'index',
					})
				)
			}
		},
		flush(targetUuid: string) {
			const relationship = pending.get(targetUuid)
			if (!relationship) return
			pending.delete(targetUuid)

			const targetEntity = uuids.current.find((e) => e.get(traits.UUID) === targetUuid)
			if (!targetEntity) return

			for (const { entity, type, indexMapping } of relationship) {
				if (!entity.isAlive()) continue
				entity.add(
					relations.SubEntityLink(targetEntity, {
						type,
						indexMapping: indexMapping ?? 'index',
					})
				)
			}
		},
		clear() {
			pending.clear()
		},
	})
}

export const useRelationships = () => {
	return getContext<ReturnType<typeof provideRelationships>>(RELATIONSHIPS_CONTEXT_KEY)
}
