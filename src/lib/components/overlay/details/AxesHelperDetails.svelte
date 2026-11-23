<script lang="ts">
	import type { Entity } from 'koota'

	import { useThrelte } from '@threlte/core/webgpu'

	import { traits, useMappedEntitiesTraits } from '#lib/ecs/index.js'

	import SharedSwitch from './SharedSwitch.svelte'
	import { sharedValue } from './sharedValue'

	interface Props {
		/** The selection. Never empty. */
		entities: readonly Entity[]
	}

	const { entities }: Props = $props()

	const { invalidate } = useThrelte()

	const shown = useMappedEntitiesTraits(
		() => entities,
		[traits.ShowAxesHelper],
		(entity) => entity.has(traits.ShowAxesHelper)
	)

	const handleToggle = (next: boolean) => {
		for (const entity of entities) {
			if (next) entity.add(traits.ShowAxesHelper)
			else entity.remove(traits.ShowAxesHelper)
		}
		invalidate()
	}
</script>

<SharedSwitch
	label="show axes helper"
	value={sharedValue(shown.current)}
	onchange={handleToggle}
/>
