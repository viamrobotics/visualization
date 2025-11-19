import { $internal as internal, type Entity, type Trait, type World } from 'koota'
import { useWorld } from './useWorld'

export type AoSFactory = () => unknown

export type Schema =
	| {
			[key: string]: number | bigint | string | boolean | null | undefined | (() => unknown)
	  }
	| AoSFactory
	| Record<string, never>

type TraitRecordFromSchema<T extends Schema> = T extends AoSFactory
	? ReturnType<T>
	: {
			[P in keyof T]: T[P] extends (...args: never[]) => unknown ? ReturnType<T[P]> : T[P]
		}

/**
 * The record of a trait.
 * For SoA it is a snapshot of the state for a single entity.
 * For AoS it is the state instance for a single entity.
 */
export type TraitRecord<T extends Trait | Schema> = T extends Trait
	? TraitRecordFromSchema<T['schema']>
	: TraitRecordFromSchema<T>

export function isWorld(target: Entity | World | null | undefined): target is World {
	return typeof (target as World)?.spawn === 'function'
}

export function useTrait<T extends Trait>(
	target: () => Entity | World | undefined | null,
	trait: T
): { current: TraitRecord<T> | undefined } {
	// Get the world from context -- it may be used.
	const contextWorld = useWorld()

	// Memoize the target entity and a subscriber function.
	// If the target is undefined or null, undefined is returned here so the hook can exit early.
	const _target = $derived(target())

	const world = isWorld(_target) ? _target : contextWorld
	const entity = isWorld(_target) ? _target[internal].worldEntity : _target

	// Initialize the state with the current value of the trait.
	let value = $state.raw<TraitRecord<T> | undefined>(
		entity?.has(trait) ? entity.get(trait) : undefined
	)

	$effect.pre(() => {
		const onChangeUnsub = world.onChange(trait, (e) => {
			if (e === entity) value = e.get(trait)
		})

		const onAddUnsub = world.onAdd(trait, (e) => {
			if (e === entity) value = e.get(trait)
		})

		const onRemoveUnsub = world.onRemove(trait, (e) => {
			if (e === entity) value = undefined
		})

		value = entity?.has(trait) ? entity.get(trait) : undefined

		return () => {
			onChangeUnsub()
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
