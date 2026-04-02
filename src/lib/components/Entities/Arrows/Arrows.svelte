<script lang="ts">
	import type { Entity } from 'koota'

	import { T } from '@threlte/core'
	import { Portal } from '@threlte/extras'

	import type { InstancedArrows } from '$lib/three/InstancedArrows/InstancedArrows'

	import { useEntityEvents } from '$lib/components/Entities/hooks/useEntityEvents.svelte'
	import { traits, useTrait } from '$lib/ecs'
	import { useFocusedEntity, useSelectedEntity } from '$lib/hooks/useSelection.svelte'
	import { meshBoundsRaycast, raycast } from '$lib/three/InstancedArrows/raycast'

	interface Props {
		entity: Entity
		arrows: InstancedArrows
	}

	let { entity, arrows }: Props = $props()

	const parent = useTrait(() => entity, traits.Parent)
	const invisible = useTrait(() => entity, traits.Invisible)

	const events = useEntityEvents(() => entity)
	const selectedEntity = useSelectedEntity()
	const focusedEntity = useFocusedEntity()

	const displayEntity = $derived(selectedEntity.current ?? focusedEntity.current)

	const raycastFunction = $derived.by(() => {
		if (displayEntity) {
			return raycast
		}
		return meshBoundsRaycast
	})
</script>

<Portal id={parent.current}>
	<T
		is={arrows}
		name={entity}
		{...events}
		raycast={raycastFunction}
	>
		<T
			is={arrows.headMesh}
			bvh={{ enabled: false }}
			raycast={() => null}
			visible={invisible.current}
		/>
		<T
			is={arrows.shaftMesh}
			bvh={{ enabled: false }}
			raycast={() => null}
		/>
	</T>
</Portal>
