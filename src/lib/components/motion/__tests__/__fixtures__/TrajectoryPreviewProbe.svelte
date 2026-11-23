<script
	module
	lang="ts"
>
	import type { World } from 'koota'

	/** What a spec reads off the scene: its world, and how many frames it has rendered. */
	export interface TrajectoryPreviewProbeHandle {
		world: World
		renderedFrames: () => number
		invalidate: () => void
	}
</script>

<script lang="ts">
	import { useTask, useThrelte } from '@threlte/core/webgpu'

	import { useWorld } from '#lib/ecs/index.js'

	interface Props {
		onready: (probe: TrajectoryPreviewProbeHandle) => void
	}

	let { onready }: Props = $props()

	const world = useWorld()
	const { renderStage, invalidate } = useThrelte()

	let renderedFrames = 0

	// In the render stage, so it counts only the frames the on-demand canvas actually renders.
	useTask(
		() => {
			renderedFrames += 1
		},
		{ stage: renderStage, autoInvalidate: false }
	)

	$effect(() => {
		onready({ world, renderedFrames: () => renderedFrames, invalidate })
	})
</script>
