<script lang="ts">
	import { traits, useQuery } from '$lib/ecs'
	import { useFullscreen } from '$lib/plugins/Fullscreen/useFullscreen.svelte'

	import type { KinematicsWorkbench } from '../../kinematics/kinematicsWorkbench.svelte'

	import KinematicsEntityDetails from './KinematicsEntityDetails.svelte'
	import { usePendingSelection } from './usePendingSelection.svelte'

	interface Props {
		/** The page's workbench. The selected entity comes from the scene, through `traits.Selected`. */
		workbench: KinematicsWorkbench
	}

	const { workbench }: Props = $props()

	const selected = useQuery(traits.Selected)
	const fullscreen = useFullscreen()
	const pending = usePendingSelection()
</script>

{#each selected.current as entity, index (entity)}
	<KinematicsEntityDetails
		{entity}
		{workbench}
		select={pending.select}
		style="transform: translate(0, {fullscreen.baseOffset + index * 40}px)"
	/>
{/each}
