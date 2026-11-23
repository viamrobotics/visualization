<script lang="ts">
	import { ViamProvider } from '@viamrobotics/svelte-sdk'

	import type { MoveTarget } from '../../MoveTarget'

	import ScopedScene from '../../../ScopedScene/ScopedScene.svelte'
	import MoveTargetGizmo from '../../MoveTargetGizmo.svelte'
	import MoveTargetGizmoProbe, {
		type MoveTargetGizmoProbeHandle,
	} from './MoveTargetGizmoProbe.svelte'

	interface Props {
		frame: string
		target?: MoveTarget
		disabled?: boolean
		isGizmoMounted?: boolean
		onDrag?: (target: MoveTarget) => void
		onRelease?: (target: MoveTarget) => void
		onready: (probe: MoveTargetGizmoProbeHandle) => void
	}

	let {
		frame,
		target = $bindable(),
		disabled = false,
		isGizmoMounted = true,
		onDrag,
		onRelease,
		onready,
	}: Props = $props()
</script>

<ViamProvider dialConfigs={{}}>
	<div style="width: 672px; height: 504px">
		<ScopedScene
			partID="part-0"
			{frame}
		>
			<MoveTargetGizmoProbe {onready} />

			{#if isGizmoMounted}
				<MoveTargetGizmo
					{frame}
					bind:target
					{disabled}
					{onDrag}
					{onRelease}
				/>
			{/if}
		</ScopedScene>
	</div>
</ViamProvider>
