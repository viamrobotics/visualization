<!--
@component

Mounts SceneView the way a host does: inside ViamProvider, in an explicitly sized box. Reads a plan
reply through the scene-free motion entry, the way a host's own move code does.
-->
<script lang="ts">
	import { ViamProvider } from '@viamrobotics/svelte-sdk'
	import { SceneView } from '@viamrobotics/visualization/core'
	import { parsePlanResult } from '@viamrobotics/visualization/motion'

	const { trajectory } = parsePlanResult({ plan: [{ arm: [0, 0, 0, 0, 0, 0] }] })
</script>

<ViamProvider dialConfigs={{}}>
	<div
		style="width: 672px; height: 504px;"
		data-planned-steps={trajectory.length}
	>
		<SceneView />
	</div>
</ViamProvider>
