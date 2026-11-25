<script lang="ts">
	import { backendIP } from '#lib/defines.js'
	import { ControlWidgets } from '#lib/plugins/ControlWidgets/index.js'
	import {
		BuildFrames,
		DrawService,
		FileDrop,
		Isolate,
		Logs,
		Machine,
		MeasureTool,
		MotionPlanReplayer,
		MoveFrame,
		SceneExport,
		SensorCoverage,
		Settings,
		WorldTree,
		XR,
		XRMachine,
	} from '#lib/plugins/index.js'
	import { RenderStats } from '#lib/plugins/RenderStats/index.js'

	import { createIKSolutionsResolver } from '../../lib/createIKSolutionsResolver'
	import { useDrawServer } from '../../lib/hooks/useDrawServer.svelte'
	import { useMachineConnection } from '../../lib/hooks/useMachineConnection.svelte'

	const machineConnection = useMachineConnection()
	const drawServer = useDrawServer()

	let { children } = $props()

	const resolveIKSolutions = createIKSolutionsResolver(() => drawServer.url)
</script>

{@render children()}

<Machine partID={machineConnection.partID}>
	<SensorCoverage />

	<BuildFrames />
	<MoveFrame />

	<XR anchorKey="xr-origin-anchor:{machineConnection.partID}">
		<XRMachine />
	</XR>

	<ControlWidgets />
</Machine>

{#if drawServer.ready}
	<DrawService config={{ backendIP, port: drawServer.port }} />
{/if}
<Isolate />
<MeasureTool />
<MotionPlanReplayer {resolveIKSolutions} />
<WorldTree />
<Logs />
<SceneExport />
<Settings />
<RenderStats />
<FileDrop />
