<script lang="ts">
	import PoseDetails from '$lib/components/overlay/details/PoseDetails.svelte'
	import { traits } from '$lib/ecs'
	import { useDetailsSection } from '$lib/hooks/useDetailsSections.svelte'

	import GizmoDimensions from './GizmoDimensions.svelte'
	import PlaneDetails from './PlaneDetails.svelte'
	import { ReferencePlane } from './traits'

	useDetailsSection({
		snippet: gizmoPose,
		when: (entity) => entity.has(traits.Gizmo),
	})

	useDetailsSection({
		snippet: gizmoPlaneDimensions,
		when: (entity) => entity.has(ReferencePlane),
	})

	// `MonitorDetails` and `BuildDetails` suppress their read-only `DimensionsDetails`
	// for a `CustomDetails`-tagged entity, so a box/sphere/capsule gizmo needs its own
	// editable rows here instead.
	useDetailsSection({
		snippet: gizmoDimensions,
		when: (entity) =>
			(entity.has(traits.Box) || entity.has(traits.Sphere) || entity.has(traits.Capsule)) &&
			!entity.has(ReferencePlane),
	})
</script>

{#snippet gizmoPose({ entity }: { entity: import('koota').Entity })}
	<PoseDetails
		{entity}
		editable
	/>
{/snippet}

{#snippet gizmoPlaneDimensions({ entity }: { entity: import('koota').Entity })}
	<PlaneDetails {entity} />
{/snippet}

{#snippet gizmoDimensions({ entity }: { entity: import('koota').Entity })}
	<GizmoDimensions {entity} />
{/snippet}
