<!--
@component

Renders the gizmo traits that have no core renderer of their own. Coordinate
systems, boxes, spheres, capsules, and arrows already render off their shared
traits regardless of the Gizmo tag, so a reference plane and the measurement
labels are what's left here.
-->
<script lang="ts">
	import Label from '$lib/components/Entities/Label.svelte'
	import { useQuery } from '$lib/ecs'

	import GizmoAngleMeasure from './GizmoAngleMeasure.svelte'
	import GizmoPlane from './GizmoPlane.svelte'
	import GizmoPolylineMeasure from './GizmoPolylineMeasure.svelte'
	import { AngleMeasure, PolylineMeasure, ReferencePlane } from './traits'

	const planeGizmos = useQuery(ReferencePlane)
	const polylineMeasureGizmos = useQuery(PolylineMeasure)
	const angleMeasureGizmos = useQuery(AngleMeasure)
</script>

{#each planeGizmos.current as entity (entity)}
	<GizmoPlane {entity}>
		<Label {entity} />
	</GizmoPlane>
{/each}

{#each polylineMeasureGizmos.current as entity (entity)}
	<GizmoPolylineMeasure {entity} />
{/each}

{#each angleMeasureGizmos.current as entity (entity)}
	<GizmoAngleMeasure {entity} />
{/each}
