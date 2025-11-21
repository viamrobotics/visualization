import { traits } from '$lib/ecs'
import type { Entity } from 'koota'

export const usePersistentUUIDs = () => {
	const uuids = new Map<string, string>()

	const updateUUIDs = (entities: Entity[]) => {
		for (const entity of entities) {
			const ref = `${entity.get(traits.Parent)}-${entity.get(traits.Name)}`
			const uuid = entity.get(traits.UUID)

			if (uuid && uuids.has(ref) === false) {
				uuids.set(ref, uuid)
			}

			const refId = uuids.get(ref)

			if (refId && refId !== uuid) {
				entity.set(traits.UUID, refId)
			}
		}
	}

	return { uuids, updateUUIDs }
}
