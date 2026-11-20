<!--
@component

Lists the part's arm position savers in the world tree and draws the target of each selected one.
Mount only in move mode.
-->
<script lang="ts">
	import { traits, useQuery } from '#lib/ecs/index.js'

	import SavedPoseGhost from './SavedPoseGhost.svelte'
	import { useSavedPoseEntities } from './useSavedPoseEntities.svelte'

	useSavedPoseEntities()

	const selected = useQuery(traits.Selected, traits.SavedPose)
</script>

{#each selected.current as entity (entity)}
	<SavedPoseGhost {entity} />
{/each}
