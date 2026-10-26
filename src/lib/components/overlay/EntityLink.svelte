<script lang="ts">
	import type { Entity } from 'koota'

	import { selectOnly, traits, useTrait, useWorld } from '$lib/ecs'

	interface Props {
		entity: Entity
		/** Shown in place of the entity's own `Name`, for an entity whose name is an internal one. */
		label?: string
	}

	let { entity, label }: Props = $props()

	const world = useWorld()
	const name = useTrait(() => entity, traits.Name)
	const text = $derived(label ?? name.current)
</script>

<button
	type="button"
	class="cursor-pointer underline-offset-2 hover:underline focus-visible:underline"
	aria-label="Select {text}"
	onclick={(event) => {
		event.stopPropagation()
		selectOnly(world, entity)
	}}
>
	{text}
</button>
