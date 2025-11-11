<script lang="ts">
	import type { Snippet } from 'svelte'
	import { provideFrames } from '$lib/hooks/useFrames.svelte'
	import { provideGeometries } from '$lib/hooks/useGeometries.svelte'
	import { providePointclouds } from '$lib/hooks/usePointclouds.svelte'
	import { usePartID } from '$lib/hooks/usePartID.svelte'
	import { provideSelection } from '$lib/hooks/useSelection.svelte'
	import { provideStaticGeometries } from '$lib/hooks/useStaticGeometries.svelte'
	import { provideVisibility } from '$lib/hooks/useVisibility.svelte'
	import { provideDrawAPI } from '$lib/hooks/useDrawAPI.svelte'
	import { provideMachineSettings } from '$lib/hooks/useMachineSettings.svelte'
	import {
		provideCameraControls,
		provideTransformControls,
		type CameraPose,
	} from '$lib/hooks/useControls.svelte'
	import { provideObjects } from '$lib/hooks/useObjects.svelte'
	import { provideMotionClient } from '$lib/hooks/useMotionClient.svelte'
	import { provideLogs } from '$lib/hooks/useLogs.svelte'
	import { provideOrigin } from './xr/useOrigin.svelte'
	import { provideWorldStates } from '$lib/hooks/useWorldState.svelte'
	import { provideArmClient } from '$lib/hooks/useArmClient.svelte'
	import { provideArrows } from '$lib/hooks/useArrows.svelte'
	import { providePointcloudObjects } from '$lib/hooks/usePointcloudObjects.svelte'
	import { provideFramelessComponents } from '$lib/hooks/useFramelessComponents.svelte'
	import { provideResourceByName } from '$lib/hooks/useResourceByName.svelte'
	import { provide3DModels } from '$lib/hooks/use3DModels.svelte'

	interface Props {
		cameraPose?: CameraPose
		children: Snippet<[{ focus: boolean }]>
	}

	let { cameraPose, children }: Props = $props()

	const partID = usePartID()

	provideCameraControls(() => cameraPose)
	provideTransformControls()
	provideVisibility()
	provideMachineSettings()
	provideLogs()

	provideArrows()
	provideOrigin()
	provideStaticGeometries()
	provideDrawAPI()

	provideResourceByName(() => partID.current)
	provideFrames(() => partID.current)
	provideGeometries(() => partID.current)
	providePointcloudObjects(() => partID.current)
	provide3DModels(() => partID.current)
	providePointclouds(() => partID.current)
	provideMotionClient(() => partID.current)
	provideArmClient(() => partID.current)
	provideObjects()
	provideWorldStates()
	provideFramelessComponents()

	const { focus } = provideSelection()
</script>

{@render children({ focus: focus.current !== undefined })}
