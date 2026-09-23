<script lang="ts">
	import PoseDetails from '$lib/components/overlay/details/PoseDetails.svelte'
	import { traits } from '$lib/ecs'
	import { useDetailsSection } from '$lib/hooks/useDetailsSections.svelte'

	useDetailsSection({
		snippet: gizmoPose,
		when: (entity) => entity.has(traits.Gizmo),
	})
</script>

{#snippet gizmoPose({ entity }: { entity: import('koota').Entity })}
	<PoseDetails
		{entity}
		editable
	/>
{/snippet}
