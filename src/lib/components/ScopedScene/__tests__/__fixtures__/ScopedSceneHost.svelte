<script lang="ts">
	import type { World } from 'koota'
	import type { Camera } from 'three'

	import { ViamProvider } from '@viamrobotics/svelte-sdk'

	import type { useSettings } from '#lib/hooks/useSettings.svelte.js'

	import { ScopedScene } from '../../../../scoped-scene'
	import SceneProbe from './SceneProbe.svelte'

	interface Props {
		sceneCount?: number
		withoutPartID?: boolean
		frame?: string
		inputBindingsEnabled?: boolean
		snapping?: boolean
		poseRefreshRate?: number
		onready: (
			index: number,
			probe: { world: World; settings: ReturnType<typeof useSettings>; camera: () => Camera }
		) => void
	}

	let {
		sceneCount = 1,
		withoutPartID = false,
		frame,
		inputBindingsEnabled,
		snapping,
		poseRefreshRate,
		onready,
	}: Props = $props()
</script>

<ViamProvider dialConfigs={{}}>
	{#each { length: sceneCount }, index (index)}
		<div
			data-testid="scoped-scene-{index}"
			style="width: 672px; height: 504px"
		>
			<ScopedScene
				partID={withoutPartID ? undefined : `part-${index}`}
				{frame}
				{inputBindingsEnabled}
				{snapping}
				{poseRefreshRate}
			>
				<SceneProbe onready={(probe) => onready(index, probe)} />
			</ScopedScene>
		</div>
	{/each}
</ViamProvider>
