<!--
@component

Mounts ScopedScene the way a host does: inside ViamProvider, in an explicitly sized box, with the
headless gizmo and preview as scene children.
-->
<script lang="ts">
	import { ViamProvider } from '@viamrobotics/svelte-sdk'
	import {
		type MoveTarget,
		MoveTargetGizmo,
		parsePlanResult,
		ScopedScene,
		TrajectoryPreview,
		type TrajectoryStep,
	} from '@viamrobotics/visualization/scoped-scene'

	let target = $state<MoveTarget>()

	const trajectory: TrajectoryStep[] = parsePlanResult({
		plan: [{ arm: [0, 0, 0, 0, 0, 0] }],
	}).trajectory
</script>

<ViamProvider dialConfigs={{}}>
	<div style="width: 672px; height: 504px;">
		<ScopedScene frame="arm">
			<MoveTargetGizmo
				frame="arm"
				bind:target
			/>
			<TrajectoryPreview {trajectory} />
		</ScopedScene>
	</div>
</ViamProvider>
