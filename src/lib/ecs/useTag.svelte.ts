import { type Entity, $internal as internal, type TagTrait, type World } from 'koota'

import { useWorld } from './useWorld'

export function isWorld(target: Entity | World): target is World {
	return typeof (target as World)?.spawn === 'function'
}

export function useTag(
	target: () => Entity | World | undefined | null,
	tag: TagTrait
): { readonly current: boolean } {
	const contextWorld = useWorld()

	let value = $state(false)

	$effect(() => {
		const t = target()

		if (!t) {
			value = false
			return
		}

		const world = isWorld(t) ? t : contextWorld

		// eslint-disable-next-line prefer-const
		let entity: Entity

		// Subscribe before reading worldEntity: world.onAdd triggers the lazy registration that creates it.
		const onAddUnsub = world.onAdd(tag, (e) => {
			if (e === entity) value = true
		})

		const onRemoveUnsub = world.onRemove(tag, (e) => {
			if (e === entity) value = false
		})

		entity = isWorld(t) ? t[internal].worldEntity : t
		value = entity.has(tag)

		return () => {
			onAddUnsub()
			onRemoveUnsub()
		}
	})

	return {
		get current() {
			return value
		},
	}
}
