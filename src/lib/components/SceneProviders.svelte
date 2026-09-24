<script lang="ts">
	import type { Snippet } from 'svelte'

	import { provideHierarchy, provideWorldMatrix } from '$lib/ecs'
	import { provide3DModels } from '$lib/hooks/use3DModels.svelte'
	import { provideArmClient } from '$lib/hooks/useArmClient.svelte'
	import { provideArmKinematics } from '$lib/hooks/useArmKinematics.svelte'
	import { provideConfigFrames } from '$lib/hooks/useConfigFrames.svelte'
	import { provideTransformControls } from '$lib/hooks/useControls.svelte'
	import { provideFramelessComponents } from '$lib/hooks/useFramelessComponents.svelte'
	import { provideFrames } from '$lib/hooks/useFrames.svelte'
	import { provideInheritedInvisible } from '$lib/hooks/useInheritedInvisible.svelte'
	import { provideLinkedEntities } from '$lib/hooks/useLinked.svelte'
	import { provideOpacityOverrides } from '$lib/hooks/useOpacityOverrides.svelte'
	import { usePartID } from '$lib/hooks/usePartID.svelte'
	import { providePointcloudObjects } from '$lib/hooks/usePointcloudObjects.svelte'
	import { providePointclouds } from '$lib/hooks/usePointclouds.svelte'
	import { providePoses } from '$lib/hooks/usePoses.svelte'
	import { provideRelationships } from '$lib/hooks/useRelationships.svelte'
	import { provideResourceByName } from '$lib/hooks/useResourceByName.svelte'
	import { provideWorldStates } from '$lib/hooks/useWorldState.svelte'

	import ArmModels from './Machine/ArmModels.svelte'
	import PointCloudObjects from './Machine/PointCloudObjects.svelte'
	import PointClouds from './Machine/PointClouds.svelte'
	import WorldStates from './Machine/WorldStates.svelte'

	interface Props {
		children: Snippet
	}

	let { children }: Props = $props()

	const partID = usePartID()

	provideTransformControls()

	provideHierarchy()
	provideWorldMatrix()
	provideInheritedInvisible()
	provideOpacityOverrides()

	provideRelationships()

	provideResourceByName(() => partID.current)
	provideConfigFrames()
	provideFrames(() => partID.current)
	providePoses(() => partID.current)
	provide3DModels(() => partID.current)
	providePointclouds(() => partID.current)
	providePointcloudObjects(() => partID.current)
	provideArmClient(() => partID.current)
	provideArmKinematics(() => partID.current)
	provideWorldStates(() => partID.current)
	provideFramelessComponents()

	provideLinkedEntities()
</script>

<PointClouds />
<PointCloudObjects />
<ArmModels />
<WorldStates />

{@render children()}
