<!--
@component

Renders the machine with `partID`: its frames, geometries, point clouds, vision results, arm
models, and world state. Provides the machine's context, so plugins that need a machine go
inside it.

```svelte
<Visualizer>
	<Machine {partID}>
		<BuildFrames />
		<MoveFrame />
	</Machine>
</Visualizer>
```
-->
<script lang="ts">
	import type { Snippet } from 'svelte'

	import { useToast } from '@viamrobotics/prime-ui'

	import type { FragmentInfo } from '#lib/hooks/useFragmentInfo.svelte.js'
	import type { AppEmbeddedPartConfigProps } from '#lib/hooks/usePartConfig.svelte.js'

	import type { Entity } from 'koota'

	import { appearanceKeyOf } from '#lib/appearanceTarget.js'
	import DetailsSection from '#lib/components/overlay/details/DetailsSection.svelte'
	import DomPortal from '#lib/components/overlay/Portals/DomPortal.svelte'
	import ModeTogglePortal from '#lib/components/overlay/Portals/ModeTogglePortal.svelte'
	import SettingsPortal from '#lib/components/overlay/Portals/SettingsPortal.svelte'
	import ModeButton from '#lib/components/overlay/workspace/ModeButton.svelte'
	import { folderSettingsPortalId, traits } from '#lib/ecs/index.js'
	import { provideResourceHealth } from '#lib/hooks/resources/useResourceHealth.svelte.js'
	import { provide3DModels } from '#lib/hooks/use3DModels.svelte.js'
	import { provideArmClient } from '#lib/hooks/useArmClient.svelte.js'
	import { provideArmKinematics } from '#lib/hooks/useArmKinematics.svelte.js'
	import { provideConfigFrames } from '#lib/hooks/useConfigFrames.svelte.js'
	import { useEnvironment, useEnvironmentMode } from '#lib/hooks/useEnvironment.svelte.js'
	import { provideFragmentInfo } from '#lib/hooks/useFragmentInfo.svelte.js'
	import { useFramelessComponentEntities } from '#lib/hooks/useFramelessComponentEntities.svelte.js'
	import { provideFramelessComponents } from '#lib/hooks/useFramelessComponents.svelte.js'
	import { provideFrames } from '#lib/hooks/useFrames.svelte.js'
	import { providePartConfig } from '#lib/hooks/usePartConfig.svelte.js'
	import { createPartIDContext } from '#lib/hooks/usePartID.svelte.js'
	import { providePointcloudObjects } from '#lib/hooks/usePointcloudObjects.svelte.js'
	import { providePointclouds } from '#lib/hooks/usePointclouds.svelte.js'
	import { providePoses } from '#lib/hooks/usePoses.svelte.js'
	import { provideResourceAppearance } from '#lib/hooks/useResourceAppearance.svelte.js'
	import { provideResourceByName } from '#lib/hooks/useResourceByName.svelte.js'
	import { provideWorldStates } from '#lib/hooks/useWorldState.svelte.js'

	import ArmModels from './ArmModels.svelte'
	import PointCloudObjects from './PointCloudObjects.svelte'
	import PointClouds from './PointClouds.svelte'
	import SessionAppearanceDetails from './SessionAppearanceDetails.svelte'
	import CameraSettings from './settings/CameraSettings.svelte'
	import FramesSettings from './settings/FramesSettings.svelte'
	import VisionSettings from './settings/VisionSettings.svelte'
	import { useCameraTraits } from './useCameraTraits.svelte'
	import { useKinematicsTraits } from './useKinematicsTraits.svelte'
	import WorldStates from './WorldStates.svelte'

	interface Props {
		partID: string

		/** The part config, when the embedding host owns and saves it. Omit to load and save it here. */
		localConfigProps?: AppEmbeddedPartConfigProps

		/**
		 * Maps a component name to the fragment that defines it. Embedded hosts
		 * supply this. Omit it to compute it from fragment queries.
		 */
		componentNameToFragmentInfo?: Record<string, FragmentInfo>

		/** Plugins that need the machine. */
		children?: Snippet
	}

	const { partID, localConfigProps, componentNameToFragmentInfo, children }: Props = $props()

	const environment = useEnvironment()
	const toast = useToast()

	// Registered here, ahead of any mode its children add, so monitor is the first mode and the fallback.
	useEnvironmentMode('monitor')

	createPartIDContext(() => partID)

	// Ahead of the part config, which routes frame edits through it.
	provideFragmentInfo(
		() => partID,
		() => componentNameToFragmentInfo,
		() => localConfigProps?.current
	)

	providePartConfig(
		() => partID,
		() => localConfigProps,
		(message) => toast.danger(message)
	)

	$effect(() => {
		environment.current.isStandalone = !localConfigProps
		return () => {
			environment.current.isStandalone = true
		}
	})

	provideResourceByName(() => partID)
	provideResourceHealth(() => partID)
	provideConfigFrames()
	provideResourceAppearance(() => partID)
	provideFrames(() => partID)
	providePoses(() => partID)
	provide3DModels(() => partID)
	providePointclouds(() => partID)
	providePointcloudObjects(() => partID)
	provideArmClient(() => partID)
	provideArmKinematics(() => partID)
	provideWorldStates(() => partID)
	provideFramelessComponents()
	useFramelessComponentEntities(() => partID)
	useCameraTraits()
	useKinematicsTraits()

	/** A frame's appearance is kept per resource, so it reaches every frame of that resource. */
	const isNamedFrame = (entity: Entity) => entity.has(traits.FramesAPI) && entity.has(traits.Name)
</script>

<ModeTogglePortal>
	<ModeButton
		class="rounded-r-none"
		mode="monitor"
		description="Monitor live machine data"
	/>
</ModeTogglePortal>

<DetailsSection
	label="appearance"
	tab="appearance"
	when={isNamedFrame}
	replacesAppearance
>
	{#snippet children({ entities })}
		<SessionAppearanceDetails
			targets={entities.map((entity) => ({
				entity,
				...appearanceKeyOf(entity.get(traits.Name) ?? ''),
			}))}
		/>
	{/snippet}
</DetailsSection>

<PointClouds />
<PointCloudObjects />
<ArmModels />
<WorldStates />

<SettingsPortal
	label="Frames"
	order={10}
>
	<FramesSettings />
</SettingsPortal>

<SettingsPortal
	label="Cameras"
	order={25}
>
	<CameraSettings />
</SettingsPortal>

<SettingsPortal
	label="Vision"
	order={30}
>
	<VisionSettings />
</SettingsPortal>

<DomPortal id={folderSettingsPortalId('frames')}>
	<FramesSettings />
</DomPortal>

<DomPortal id={folderSettingsPortalId('pointclouds')}>
	<CameraSettings />
</DomPortal>

<DomPortal id={folderSettingsPortalId('pointcloud-objects')}>
	<VisionSettings />
</DomPortal>

{@render children?.()}
