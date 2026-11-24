<script lang="ts">
	import type { World } from 'koota'
	import type { Camera } from 'three'

	import { ViamProvider } from '@viamrobotics/svelte-sdk'

	import type { EventBus } from '#lib/hooks/useEventBus.js'
	import type { useSettings } from '#lib/hooks/useSettings.svelte.js'

	import { SceneView } from '../../../../core'
	import SceneProbe from './SceneProbe.svelte'

	interface Props {
		sceneCount?: number
		withoutPartID?: boolean
		inputBindingsEnabled?: boolean
		snapping?: boolean
		poseRefreshRate?: number
		onready: (
			index: number,
			probe: {
				world: World
				settings: ReturnType<typeof useSettings>
				camera: () => Camera
				bus: EventBus
				isSceneBus: boolean
			}
		) => void
	}

	let {
		sceneCount = 1,
		withoutPartID = false,
		inputBindingsEnabled,
		snapping,
		poseRefreshRate,
		onready,
	}: Props = $props()
</script>

<ViamProvider dialConfigs={{}}>
	{#each { length: sceneCount }, index (index)}
		<div
			data-testid="scene-view-{index}"
			style="width: 672px; height: 504px"
		>
			<SceneView
				partID={withoutPartID ? undefined : `part-${index}`}
				{inputBindingsEnabled}
				{snapping}
				{poseRefreshRate}
			>
				<SceneProbe onready={(probe) => onready(index, probe)} />
			</SceneView>
		</div>
	{/each}
</ViamProvider>
