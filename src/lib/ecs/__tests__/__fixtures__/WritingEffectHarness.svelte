<script lang="ts">
	import type { Entity } from 'koota'

	import { traits, useMappedEntitiesTraits } from '#lib/ecs/index.js'

	interface Props {
		/** Must carry `Opacity`, so the write below fires `onChange`. */
		entity: Entity
		/** Called each time the writing effect runs. */
		onwrite: () => void
	}

	const { entity, onwrite }: Props = $props()

	const opacities = useMappedEntitiesTraits(
		() => [entity],
		[traits.Opacity],
		(target) => target.get(traits.Opacity)
	)

	$effect(() => {
		onwrite()
		entity.set(traits.Opacity, 0.5)
	})
</script>

<p>{opacities.current.join(',')}</p>
