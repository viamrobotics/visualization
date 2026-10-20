import type { Entity, Trait } from 'koota'

/**
 * Write `value` into `trait`, adding the trait first when the entity doesn't
 * have it yet.
 *
 * koota's `entity.set` writes the trait's store slot without touching the
 * entity's mask, so on an entity that lacks the trait `has` stays false and
 * nothing querying it ever sees the value — the write is silently lost. Its
 * `entity.add` has the mirror-image problem: it returns early when the trait is
 * already present, dropping the value it was passed. Neither is safe on its own
 * for reconcilers that upsert a trait whose presence depends on what the
 * network happened to send.
 */
export const setOrAddTrait = <T extends Trait>(
	entity: Entity,
	trait: T,
	value: Parameters<T>[0]
): void => {
	if (entity.has(trait)) {
		entity.set(trait, value)
	} else {
		entity.add(trait(value))
	}
}
