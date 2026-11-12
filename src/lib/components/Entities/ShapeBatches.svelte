<!--
@component

Mounts the batches every primitive renderer draws into, and provides them to its
children. `Boxes`, `Capsules`, `Cylinders`, and `Spheres` allocate instances
rather than owning meshes. Opaque shapes share one batch in the opaque pass, and
translucent ones share another, so one depth sort covers every translucent
primitive in the scene.

The faces batches are the pointer-interaction surface: each raycasts per instance
(skipping invisible ones) and stamps `batchId` on each hit, which `entityAt`
maps back to the entity.
-->
<script lang="ts">
	import type { Snippet } from 'svelte'

	import { T } from '@threlte/core/webgpu'

	import { useSettings } from '$lib/hooks/useSettings.svelte'
	import { createShapeBatches } from '$lib/three/shapeBatches'
	import { createSurfaceMaterial } from '$lib/three/surfaceShading'

	import { useInstancedEntityEvents } from './hooks/useEntityEvents.svelte'
	import { useSurfaceMaterials } from './hooks/useSurfaceMaterials.svelte'
	import { provideShapeBatches } from './useShapeBatches'

	interface Props {
		children: Snippet
	}

	const { children }: Props = $props()

	const settings = useSettings()

	const batches = createShapeBatches((parameters) =>
		createSurfaceMaterial(settings.current.renderMode, parameters)
	)

	const passes = [batches.opaque, batches.translucent]

	const shapes = provideShapeBatches(batches)

	useSurfaceMaterials(passes.map((pass) => ({ mesh: pass.faces, parameters: pass.faceParameters })))

	const events = useInstancedEntityEvents((event) =>
		event.batchId === undefined ? undefined : shapes.entityAt(event.object, event.batchId)
	)
</script>

<!--
`bvh={{ enabled: false }}` on every batch: the plugin would replace `raycast` with
three-mesh-bvh's, and `BatchedMesh`'s own per-instance raycast is what stamps
`batchId`.
-->
{#each passes as pass (pass.faces.id)}
	<T
		is={pass.faces}
		bvh={{ enabled: false }}
		{...events}
	/>

	<T
		is={pass.edges}
		bvh={{ enabled: false }}
		raycast={() => null}
	/>
{/each}

{@render children()}
