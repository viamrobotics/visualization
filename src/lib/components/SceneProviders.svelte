<script lang="ts">
	import type { Snippet } from 'svelte'

	import { provideHierarchy, provideWorldMatrix } from '#lib/ecs/index.js'
	import { provideResourceHealth } from '#lib/hooks/resources/useResourceHealth.svelte.js'
	import { provide3DModels } from '#lib/hooks/use3DModels.svelte.js'
	import { provideArmClient } from '#lib/hooks/useArmClient.svelte.js'
	import { provideArmKinematics } from '#lib/hooks/useArmKinematics.svelte.js'
	import { provideConfigFrames } from '#lib/hooks/useConfigFrames.svelte.js'
	import { provideTransformControls } from '#lib/hooks/useControls.svelte.js'
	import { provideFramelessComponents } from '#lib/hooks/useFramelessComponents.svelte.js'
	import { provideFrames } from '#lib/hooks/useFrames.svelte.js'
	import { provideInheritedInvisible } from '#lib/hooks/useInheritedInvisible.svelte.js'
	import { provideLinkedEntities } from '#lib/hooks/useLinked.svelte.js'
	import { provideOpacityOverrides } from '#lib/hooks/useOpacityOverrides.svelte.js'
	import { usePartID } from '#lib/hooks/usePartID.svelte.js'
	import { providePointcloudObjects } from '#lib/hooks/usePointcloudObjects.svelte.js'
	import { providePointclouds } from '#lib/hooks/usePointclouds.svelte.js'
	import { providePoses } from '#lib/hooks/usePoses.svelte.js'
	import { provideRelationships } from '#lib/hooks/useRelationships.svelte.js'
	import { provideResourceByName } from '#lib/hooks/useResourceByName.svelte.js'
	import { provideWorldStates } from '#lib/hooks/useWorldState.svelte.js'

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
	provideResourceHealth(() => partID.current)
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
