<script lang="ts">
	import type { Entity } from 'koota'

	import { T, useThrelte } from '@threlte/core'

	import type { InstancedArrows } from '#lib/three/InstancedArrows/InstancedArrows.js'

	import { useEntityEvents } from '#lib/components/Entities/hooks/useEntityEvents.svelte.js'
	import { traits, useTag, useTrait } from '#lib/ecs/index.js'
	import { meshBoundsRaycast, raycast } from '#lib/three/InstancedArrows/raycast.js'

	interface Props {
		entity: Entity
		arrows: InstancedArrows
	}

	let { entity, arrows }: Props = $props()

	const { invalidate } = useThrelte()
	const worldMatrix = useTrait(() => entity, traits.WorldMatrix)
	const selected = useTag(() => entity, traits.Selected)
	const invisible = useTrait(() => entity, traits.InheritedInvisible)

	const events = useEntityEvents(() => entity)

	const raycastFunction = $derived.by(() => {
		if (selected.current) {
			return raycast
		}

		return meshBoundsRaycast
	})

	$effect.pre(() => {
		arrows.matrixAutoUpdate = false
		if (!worldMatrix.current) return
		arrows.matrix.copy(worldMatrix.current)
		arrows.updateMatrixWorld()
		invalidate()
	})
</script>

<T
	is={arrows}
	name={entity}
	{...events}
	raycast={raycastFunction}
	visible={invisible.current !== true}
>
	<T
		is={arrows.headMesh}
		bvh={{ enabled: false }}
		raycast={() => null}
	/>
	<T
		is={arrows.shaftMesh}
		bvh={{ enabled: false }}
		raycast={() => null}
	/>
</T>
