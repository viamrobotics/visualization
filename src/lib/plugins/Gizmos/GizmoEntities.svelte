<!--
@component

Renders the gizmo traits that have no core renderer of their own. Coordinate
systems, boxes, spheres, capsules, and arrows already render off their shared
traits regardless of the Gizmo tag, so a reference plane is the only case
left here.
-->
<script lang="ts">
	import Label from '$lib/components/Entities/Label.svelte'
	import { useQuery } from '$lib/ecs'

	import GizmoPlane from './GizmoPlane.svelte'
	import { ReferencePlane } from './traits'

	const planeGizmos = useQuery(ReferencePlane)
</script>

{#each planeGizmos.current as entity (entity)}
	<GizmoPlane {entity}>
		<Label {entity} />
	</GizmoPlane>
{/each}
