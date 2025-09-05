import type { WorldObject } from '$lib/WorldObject.svelte'

export const usePersistentUUIDs = () => {
	const uuids = new Map<string, string>()
	const updateUUIDs = (objects: WorldObject[]) => {
		for (const object of objects) {
			const ref = `${object.referenceFrame}-${object.name}`

			if (uuids.has(ref) === false) {
				uuids.set(ref, object.uuid)
			}

			object.uuid = uuids.get(ref) ?? object.uuid
		}
	}

	return { uuids, updateUUIDs }
}
