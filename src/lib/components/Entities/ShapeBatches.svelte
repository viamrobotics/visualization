<!--
@component

Mounts the batches every primitive renderer draws into, and provides them to its
children. `Boxes`, `Capsules`, `Cylinders`, and `Spheres` allocate instances
rather than owning meshes, so one depth sort covers every transparent primitive
in the scene.

The faces batch is the pointer-interaction surface: it raycasts per instance
(skipping invisible ones) and stamps `batchId` on each hit, which `entityAt`
maps back to the entity.
-->
<script lang="ts">
	import type { Snippet } from 'svelte'

	import { T } from '@threlte/core'
	import { DoubleSide } from 'three'

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

	/**
	 * Primitives render transparent by default (see `resolveOpacity`), with
	 * per-instance alpha in the `w` of the instance color. The base color stays
	 * white so per-instance colors aren't tinted.
	 *
	 * `DoubleSide` is what lets every shape share one batch — an uncapped
	 * cylinder has no cap to hide its far wall — and it is what a translucent
	 * shell should look like, with light crossing the near wall and the far one.
	 */
	const faceParameters = { side: DoubleSide, transparent: true, vertexColors: true }

	const batches = createShapeBatches(
		createSurfaceMaterial(settings.current.renderMode, faceParameters)
	)

	const shapes = provideShapeBatches(batches)

	useSurfaceMaterials([{ mesh: batches.faces, parameters: faceParameters }])

	const events = useInstancedEntityEvents((event) =>
		event.batchId === undefined ? undefined : shapes.entityAt(event.batchId)
	)
</script>

<!--
`bvh={{ enabled: false }}` on both: the plugin would replace `raycast` with
three-mesh-bvh's, and `BatchedMesh`'s own per-instance raycast is what stamps
`batchId`.
-->
<T
	is={batches.faces}
	bvh={{ enabled: false }}
	{...events}
/>

<T
	is={batches.edges}
	bvh={{ enabled: false }}
	raycast={() => null}
/>

{@render children()}
