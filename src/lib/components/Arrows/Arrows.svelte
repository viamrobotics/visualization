<script lang="ts">
	import { T } from '@threlte/core'
	import { Portal } from '@threlte/extras'
	import type { Entity } from 'koota'
	import { traits } from '$lib/ecs'
	import { useObjectEvents } from '$lib/hooks/useObjectEvents.svelte'
	import type { InstancedArrows } from '$lib/three/InstancedArrows/InstancedArrows'
	import { meshBoundsRaycast } from '$lib/three/InstancedArrows/raycast'

	interface Props {
		entity: Entity
		arrows: InstancedArrows
	}

	let { entity, arrows }: Props = $props()

	const events = useObjectEvents(() => entity)
</script>

<Portal id={entity.get(traits.Parent)}>
	<T
		is={arrows}
		name={entity}
	>
		<T
			is={arrows.headMesh}
			bvh={{ enabled: false }}
			raycast={() => null}
			visible={events.visible}
		/>
		<T
			is={arrows.shaftMesh}
			bvh={{ enabled: false }}
			raycast={meshBoundsRaycast}
			{...events}
		/>
	</T>
</Portal>
