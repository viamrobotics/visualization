<script lang="ts">
	import { ViamProvider } from '@viamrobotics/svelte-sdk'

	import type { TrajectoryStep } from '#lib/motion/jointPose.js'

	import ScopedScene from '../../../ScopedScene/ScopedScene.svelte'
	import TrajectoryPreview from '../../TrajectoryPreview.svelte'
	import TrajectoryPreviewProbe, {
		type TrajectoryPreviewProbeHandle,
	} from './TrajectoryPreviewProbe.svelte'

	interface Props {
		frame?: string
		trajectory: TrajectoryStep[] | undefined
		step?: number
		playing?: boolean
		detail?: 'waypoints' | 'interpolated'
		onError?: (message: string) => void
		/** Called with every value the bound `step` takes, the first included. */
		onStepChange?: (step: number) => void
		onready: (probe: TrajectoryPreviewProbeHandle) => void
	}

	let {
		frame,
		trajectory,
		step = $bindable(0),
		playing = true,
		detail = 'waypoints',
		onError,
		onStepChange,
		onready,
	}: Props = $props()

	$effect(() => {
		onStepChange?.(step)
	})
</script>

<ViamProvider dialConfigs={{}}>
	<div style="width: 672px; height: 504px">
		<ScopedScene
			partID="part-0"
			{frame}
		>
			<TrajectoryPreviewProbe {onready} />
			<TrajectoryPreview
				{trajectory}
				bind:step
				{playing}
				{detail}
				{onError}
			/>
		</ScopedScene>
	</div>
</ViamProvider>
