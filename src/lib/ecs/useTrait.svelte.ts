import { $internal as internal, type Entity, type Trait, type World } from 'koota'
import { useWorld } from './useWorld'
import { untrack } from 'svelte'

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
	const contextWorld = useWorld()
	const targetEntity = $derived(target())
	const world = $derived(isWorld(targetEntity) ? targetEntity : contextWorld)
	const entity = $derived(isWorld(targetEntity) ? targetEntity[internal].worldEntity : targetEntity)

	// Initialize the state with the current value of the trait.
	let value = $state.raw(entity?.has(trait) ? entity.get(trait) : undefined)

	$effect(() => {
		value = entity?.has(trait) ? entity.get(trait) : undefined

		return untrack(() => {
			const onChangeUnsub = world.onChange(trait, (e) => {
				if (e === entity) {
					value = e.get(trait)
				}
			})

			const onAddUnsub = world.onAdd(trait, (e) => {
				if (e === entity) {
					value = e.get(trait)
				}
			})

			const onRemoveUnsub = world.onRemove(trait, (e) => {
				if (e === entity) {
					value = undefined
				}
			})

			return () => {
				onChangeUnsub()
				onAddUnsub()
				onRemoveUnsub()
			}
		})
	})

	return {
		get current() {
			return value
		},
	}
}
