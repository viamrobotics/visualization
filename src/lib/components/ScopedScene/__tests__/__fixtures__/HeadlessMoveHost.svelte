<script lang="ts">
	import { ViamProvider } from '@viamrobotics/svelte-sdk'

	import type { TrajectoryStep } from '#lib/motion/jointPose.js'

	import type { MoveTarget } from '../../../motion/MoveTarget'

	import MoveTargetGizmoProbe, {
		type MoveTargetGizmoProbeHandle,
	} from '../../../motion/__tests__/__fixtures__/MoveTargetGizmoProbe.svelte'
	import MoveTargetGizmo from '../../../motion/MoveTargetGizmo.svelte'
	import TrajectoryPreview from '../../../motion/TrajectoryPreview.svelte'
	import ScopedScene from '../../ScopedScene.svelte'

	interface Props {
		frame: string
		trajectory: TrajectoryStep[] | undefined
		onDrag: (target: MoveTarget) => void
		onRelease: (target: MoveTarget) => void
		onready: (probe: MoveTargetGizmoProbeHandle) => void
	}

	let { frame, trajectory, onDrag, onRelease, onready }: Props = $props()
</script>

<ViamProvider dialConfigs={{}}>
	<div style="width: 672px; height: 504px">
		<ScopedScene
			partID="part-0"
			{frame}
		>
			<MoveTargetGizmoProbe {onready} />
			<MoveTargetGizmo
				{frame}
				{onDrag}
				{onRelease}
			/>
			<TrajectoryPreview {trajectory} />
		</ScopedScene>
	</div>
</ViamProvider>
