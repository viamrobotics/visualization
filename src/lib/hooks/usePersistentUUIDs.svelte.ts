import { traits } from '$lib/ecs'
import type { Entity } from 'koota'
import { MathUtils } from 'three'

export const usePersistentUUIDs = () => {
	const uuids = new Map<string, string>()

	const updateUUIDs = (entities: Entity[]) => {
		for (const entity of entities) {
			const ref = `${entity.get(traits.Parent)}-${entity.get(traits.Name)}`
			const uuid = entity.get(traits.UUID)

			if (uuid && uuids.has(ref) === false) {
				uuids.set(ref, uuid)
			}

			entity.set(traits.UUID, uuids.get(ref) ?? uuid ?? MathUtils.generateUUID())
		}
	}

	return { uuids, updateUUIDs }
}
