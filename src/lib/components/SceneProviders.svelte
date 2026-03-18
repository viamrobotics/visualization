<script lang="ts">
	import type { Snippet } from 'svelte'
	import { provideFrames } from '$lib/hooks/useFrames.svelte'
	import { provideGeometries } from '$lib/hooks/useGeometries.svelte'
	import { providePointclouds } from '$lib/hooks/usePointclouds.svelte'
	import { usePartID } from '$lib/hooks/usePartID.svelte'
	import { provideSelection } from '$lib/hooks/useSelection.svelte'
	import { provideVisibility } from '$lib/hooks/useVisibility.svelte'
	import { provideDrawAPI } from '$lib/hooks/useDrawAPI.svelte'
	import { provideDrawService } from '$lib/hooks/useDrawService.svelte'
	import { provideMachineSettings } from '$lib/hooks/useMachineSettings.svelte'
	import {
		provideCameraControls,
		provideTransformControls,
		type CameraPose,
	} from '$lib/hooks/useControls.svelte'
	import { provideLogs } from '$lib/hooks/useLogs.svelte'
	import { provideOrigin } from './xr/useOrigin.svelte'
	import { provideWorldStates } from '$lib/hooks/useWorldState.svelte'
	import { provideArmClient } from '$lib/hooks/useArmClient.svelte'
	import { provideArmKinematics } from '$lib/hooks/useArmKinematics.svelte'
	import { provideFramelessComponents } from '$lib/hooks/useFramelessComponents.svelte'
	import { provideResourceByName } from '$lib/hooks/useResourceByName.svelte'
	import { provide3DModels } from '$lib/hooks/use3DModels.svelte'
	import { providePointcloudObjects } from '$lib/hooks/usePointcloudObjects.svelte'
	import { provideLinkedEntities } from '$lib/hooks/useLinked.svelte'
	import { provideConfigFrames } from '$lib/hooks/useConfigFrames.svelte'

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

	provideOrigin()
	provideDrawAPI()
	provideDrawService()

	provideResourceByName(() => partID.current)
	provideConfigFrames()
	provideFrames(() => partID.current)
	provideGeometries(() => partID.current)
	provide3DModels(() => partID.current)
	providePointclouds(() => partID.current)
	providePointcloudObjects(() => partID.current)
	provideArmClient(() => partID.current)
	provideArmKinematics(() => partID.current)
	provideWorldStates()
	provideFramelessComponents()

	const { focus } = provideSelection()
	provideLinkedEntities()
</script>

{@render children({ focus: focus.current !== undefined })}
