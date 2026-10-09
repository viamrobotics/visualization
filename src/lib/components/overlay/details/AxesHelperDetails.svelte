<script lang="ts">
	import type { Entity } from 'koota'

	import { useThrelte } from '@threlte/core'
	import { Switch } from '@viamrobotics/prime-core'

	import { traits, useTrait } from '#lib/ecs/index.js'

	interface Props {
		entity: Entity
	}

	const { entity }: Props = $props()

	const { invalidate } = useThrelte()

	const showAxesHelper = useTrait(() => entity, traits.ShowAxesHelper)

	const handleToggle = (next: boolean) => {
		if (next) entity.add(traits.ShowAxesHelper)
		else entity.remove(traits.ShowAxesHelper)
		invalidate()
	}
</script>

<div class="flex items-center justify-between">
	<strong class="font-semibold">show axes helper</strong>
	<Switch
		on={showAxesHelper.current === true}
		on:change={(event) => handleToggle(event.detail)}
	/>
</div>
