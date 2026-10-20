<script lang="ts">
	import type { Entity } from 'koota'

	import { selectOnly, traits, useTrait, useWorld } from '$lib/ecs'

	interface Props {
		entity: Entity
	}

	let { entity }: Props = $props()

	const world = useWorld()
	const name = useTrait(() => entity, traits.Name)
</script>

<button
	type="button"
	class="cursor-pointer underline-offset-2 hover:underline focus-visible:underline"
	aria-label="Select {name.current}"
	onclick={(event) => {
		event.stopPropagation()
		selectOnly(world, entity)
	}}
>
	{name.current}
</button>
